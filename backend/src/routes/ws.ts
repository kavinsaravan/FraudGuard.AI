/**
 * WebSocket server for live transcript streaming.
 * Client connects with ?sessionId=xxx.
 * - For real calls: registers connection to receive live updates
 * - For simulated mode: sends mock transcript lines at intervals
 */

import { WebSocket } from 'ws'
import { getSession, appendTranscript, updateSession } from '../sessionStore.js'
import { registerConnection } from '../services/transcriptBroadcaster.js'

/* ── Scenario transcripts for simulation mode ──────────────────────── */

const SCENARIO_TRANSCRIPTS: Record<string, string[]> = {
  social_security: [
    'Caller: Hello, this is Officer Johnson from the Social Security Administration.',
    'Caller: We have detected suspicious activity linked to your Social Security number.',
    'You: What kind of activity?',
    'Caller: Your SSN has been used in connection with fraudulent bank accounts. We need to verify your identity immediately.',
    'Caller: Can you please confirm your full Social Security number so we can secure your account?',
    "You: I don't feel comfortable sharing that information.",
    'Caller: I understand your concern, but if we cannot verify your identity, your Social Security benefits will be suspended within 24 hours.',
    'Caller: This is a time-sensitive matter. We also need your date of birth for verification.',
    'You: I prefer to call the Social Security office directly.',
    "Caller: Ma'am, this IS the official office. If you hang up, a warrant will be issued for your arrest.",
    "You: I'm going to hang up and call the number on the SSA website.",
    "Caller: Wait — you'll lose your benefits permanently if you disconnect now.",
  ],
  tech_support: [
    "Caller: Hello, this is Microsoft Technical Support. We've detected a critical virus on your computer.",
    'Caller: Our security system shows your IP address has been compromised. Hackers may be accessing your personal files right now.',
    'You: How did you get my number?',
    "Caller: We received an automatic alert from your Windows license. This is a courtesy call to help you before it's too late.",
    'Caller: I need you to open your computer and download our remote access tool so I can remove the virus.',
    "You: I'm not sure about downloading anything.",
    'Caller: I understand, but every minute we wait, more of your data is being stolen. Can you open your web browser?',
    "Caller: If you can't do it yourself, I'll need your computer password so our team can access it remotely.",
    "You: I don't think Microsoft calls people like this.",
    "Caller: We do for premium license holders. There's a one-time security fee of $299 to clean your system. Do you have a credit card handy?",
    'You: No, this sounds like a scam.',
    'Caller: I assure you this is legitimate. Would you prefer to pay with gift cards? We accept those as well.',
  ],
  lottery_giveaway: [
    "Caller: Congratulations! You've been selected as the grand prize winner of the National Consumer Sweepstakes!",
    "Caller: You've won $500,000 and a brand new car. This is not a joke — your entry was randomly selected.",
    "You: I don't remember entering any sweepstakes.",
    'Caller: Your phone number was automatically entered through a promotional program. You are one of three winners nationwide.',
    'Caller: To process your winnings, we need to verify your identity. Can you confirm your full name and date of birth?',
    'You: What company is this with?',
    "Caller: We're with the National Prize Bureau, authorized by the Federal Trade Commission. But we need to act fast — you have 48 hours to claim.",
    'Caller: There is a small processing fee of $500 to release your winnings. You can pay via wire transfer or gift cards.',
    'You: Why would I pay to receive a prize?',
    "Caller: It's standard tax and processing — required by federal law. Once you pay, we'll deliver your check within 3 business days.",
    'Caller: We just need your bank account number to deposit the remainder directly.',
    "You: This doesn't sound right. I'm going to pass on this.",
  ],
}

const DEFAULT_TRANSCRIPT = SCENARIO_TRANSCRIPTS.social_security

const INTERVAL_MS = 2500

export function handleWsConnection(ws: WebSocket, url: string): void {
  const sessionId = new URL(url, 'http://localhost').searchParams.get(
    'sessionId'
  )
  if (!sessionId) {
    ws.close(4000, 'Missing sessionId')
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    ws.close(4001, 'Unknown sessionId')
    return
  }

  // Check if this is a real call (has callSid and AI enabled)
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY)
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY)
  const isRealCall = session.callSid && hasGroqKey && hasElevenLabsKey

  if (isRealCall) {
    // Real call mode: register connection for live updates from conversation manager
    console.log(`[ws] Real call mode - registering connection for ${sessionId}`)
    registerConnection(sessionId, ws)

    // Send any existing transcript lines
    session.transcript.forEach((line) => {
      ws.send(JSON.stringify({ line }))
    })
  } else {
    // Simulation mode: send mock transcript lines
    console.log(`[ws] Simulation mode for ${sessionId}`)
    updateSession(sessionId, { status: 'in_progress' })

    const lines = SCENARIO_TRANSCRIPTS[session.scenarioId] ?? DEFAULT_TRANSCRIPT
    let index = 0

    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(timer)
        return
      }

      if (index >= lines.length) {
        // All lines sent — mark completed and close
        clearInterval(timer)
        updateSession(sessionId, { status: 'completed' })
        ws.send(JSON.stringify({ done: true }))
        ws.close(1000, 'Simulation complete')
        return
      }

      const line = lines[index]
      index += 1
      appendTranscript(sessionId, line)
      ws.send(JSON.stringify({ line }))
    }, INTERVAL_MS)

    ws.on('close', () => {
      clearInterval(timer)
      const s = getSession(sessionId)
      if (s && s.status === 'in_progress') {
        updateSession(sessionId, { status: 'completed' })
      }
    })
  }
}

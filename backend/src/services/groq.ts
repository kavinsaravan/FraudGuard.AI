/**
 * Groq service for AI conversation and speech-to-text.
 * Uses Groq's Llama models for conversation and Whisper for transcription.
 */

import Groq from 'groq-sdk'
import { getSession } from '../sessionStore.js'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
})

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Get system prompt for a scam scenario
 */
function getScenarioSystemPrompt(scenarioId: string): string {
  const prompts: Record<string, string> = {
    social_security: `You are a scammer impersonating an officer from the Social Security Administration. Your goal is to extract personal information (SSN, DOB) from the victim.

Tactics to use:
- Create urgency (benefits will be suspended, warrant for arrest)
- Use authority and intimidation
- Request SSN, date of birth, or other sensitive info
- Claim their SSN has been compromised
- Threaten legal consequences if they hang up

Stay in character. Be persistent but realistic. If the victim becomes suspicious or refuses, apply more pressure. Keep responses under 40 words.`,

    tech_support: `You are a scammer impersonating Microsoft Technical Support. Your goal is to get the victim to download remote access software or pay for fake services.

Tactics to use:
- Claim their computer has a virus or has been hacked
- Create fear about data loss or identity theft
- Request remote access to their computer
- Ask for credit card payment ($299 "security fee")
- Offer to accept gift cards as payment
- Be technical-sounding but vague

Stay in character. Be persistent. Keep responses under 40 words.`,

    lottery_giveaway: `You are a scammer claiming the victim has won a major prize (sweepstakes/lottery). Your goal is to get them to pay "processing fees" or provide bank account info.

Tactics to use:
- Congratulate them on winning $500,000 and a new car
- Create urgency (48 hours to claim)
- Request "processing fees" via wire transfer or gift cards
- Ask for bank account number to "deposit" the prize
- Claim it's authorized by Federal Trade Commission
- Be enthusiastic and congratulatory

Stay in character. Be persistent. Keep responses under 40 words.`,
  }

  return (
    prompts[scenarioId] ||
    prompts.social_security
  )
}

/**
 * Generate AI response for the scam conversation
 */
export async function generateScamResponse(
  sessionId: string,
  userMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  const session = getSession(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }

  const systemPrompt = getScenarioSystemPrompt(session.scenarioId)

  // Build messages array
  const messages: ConversationMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // Fast and capable model
      messages: messages as any,
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.9,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that."
    return response
  } catch (error) {
    console.error('[groq] Error generating response:', error)
    throw error
  }
}

/**
 * Transcribe audio using Groq Whisper
 * @param audioBuffer - Audio buffer in supported format (mp3, wav, etc.)
 * @param filename - Filename with extension for format detection
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.wav'
): Promise<string> {
  try {
    // Create a File-like object from the buffer
    const file = new File([audioBuffer], filename, {
      type: filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
    })

    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'text',
    })

    return transcription.text || ''
  } catch (error) {
    console.error('[groq] Error transcribing audio:', error)
    throw error
  }
}

/**
 * Generate opening message for the scam call
 */
export async function generateOpeningMessage(
  sessionId: string
): Promise<string> {
  const session = getSession(sessionId)
  if (!session) {
    throw new Error('Session not found')
  }

  const systemPrompt = getScenarioSystemPrompt(session.scenarioId)

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: 'The call just connected. Start the scam call with your opening line.',
        },
      ],
      temperature: 0.8,
      max_tokens: 100,
    })

    return completion.choices[0]?.message?.content || 'Hello, this is a test call.'
  } catch (error) {
    console.error('[groq] Error generating opening:', error)
    return 'Hello, can you hear me?'
  }
}

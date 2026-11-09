/**
 * Conversation Manager - orchestrates the AI scam call flow.
 * Coordinates between Groq (LLM + STT), ElevenLabs (TTS), and Twilio (audio streaming).
 */

import { WebSocket } from 'ws'
import { generateScamResponse, generateOpeningMessage, transcribeAudio, type ConversationMessage } from './groq.js'
import { textToSpeech } from './elevenlabs.js'
import { AudioAccumulator, mulawToWav, mp3ToMulaw, detectSilence } from '../utils/audio.js'
import { appendTranscript, updateSession } from '../sessionStore.js'
import { broadcastTranscript, broadcastCallEnd } from './transcriptBroadcaster.js'

interface CallState {
  sessionId: string
  twilioWs: WebSocket
  streamSid: string
  conversationHistory: ConversationMessage[]
  audioAccumulator: AudioAccumulator
  isProcessing: boolean
  isSpeaking: boolean
  silenceTimeout: NodeJS.Timeout | null
}

const activeCalls = new Map<string, CallState>()

/**
 * Initialize a new AI-powered scam call
 */
export async function initializeCall(
  sessionId: string,
  twilioWs: WebSocket,
  streamSid: string
): Promise<void> {
  console.log(`[conversation] Initializing call for session ${sessionId}`)

  const state: CallState = {
    sessionId,
    twilioWs,
    streamSid,
    conversationHistory: [],
    audioAccumulator: new AudioAccumulator(300),
    isProcessing: false,
    isSpeaking: false,
    silenceTimeout: null,
  }

  activeCalls.set(sessionId, state)

  // Update session status
  updateSession(sessionId, { status: 'in_progress' })

  // Generate and speak opening message
  try {
    const openingMessage = await generateOpeningMessage(sessionId)
    await speakMessage(sessionId, openingMessage, 'Caller')
  } catch (error) {
    console.error('[conversation] Error with opening message:', error)
    await speakMessage(sessionId, 'Hello, can you hear me?', 'Caller')
  }
}

/**
 * Handle incoming audio from Twilio Media Stream
 */
export async function handleIncomingAudio(
  sessionId: string,
  audioPayload: string
): Promise<void> {
  const state = activeCalls.get(sessionId)
  if (!state || state.isSpeaking || state.isProcessing) {
    return
  }

  const audio = Buffer.from(audioPayload, 'base64')
  const silent = detectSilence(audio)
  if (silent && state.audioAccumulator.getDuration() === 0) return

  state.audioAccumulator.addChunk(audio)

  if (state.audioAccumulator.getDuration() >= 10_000) {
    await processAccumulatedAudio(sessionId)
  } else if (!silent) {
    // Twilio keeps sending frames during silence. Only speech extends the turn.
    if (state.silenceTimeout) clearTimeout(state.silenceTimeout)
    state.silenceTimeout = setTimeout(() => {
      void processAccumulatedAudio(sessionId)
    }, 1000)
  }
}

/**
 * Process accumulated audio: transcribe and generate response
 */
async function processAccumulatedAudio(sessionId: string): Promise<void> {
  const state = activeCalls.get(sessionId)
  if (!state || state.isProcessing) return

  if (state.silenceTimeout) clearTimeout(state.silenceTimeout)
  state.silenceTimeout = null
  const hasEnoughAudio = state.audioAccumulator.hasEnoughAudio()
  const mulawBuffer = state.audioAccumulator.flush()
  if (!hasEnoughAudio) return

  state.isProcessing = true

  try {
    console.log(`[conversation] Processing ${mulawBuffer.length} bytes of audio`)

    // Convert to WAV for transcription
    const wavBuffer = await mulawToWav(mulawBuffer)

    // Transcribe with Groq Whisper
    const userMessage = await transcribeAudio(wavBuffer, 'audio.wav')

    if (!userMessage.trim() || activeCalls.get(sessionId) !== state) return

    console.log(`[conversation] User said: "${userMessage}"`)

    // Add to transcript
    appendTranscript(sessionId, `You: ${userMessage}`)
    broadcastTranscriptUpdate(sessionId, `You: ${userMessage}`)

    // Generate AI response
    const aiResponse = await generateScamResponse(
      sessionId,
      userMessage,
      state.conversationHistory
    )

    console.log(`[conversation] AI response: "${aiResponse}"`)

    // Update conversation history
    state.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    )

    // Speak the response
    await speakMessage(sessionId, aiResponse, 'Caller')
  } catch (error) {
    console.error('[conversation] Error processing audio:', error)
  } finally {
    state.isProcessing = false
  }
}

/**
 * Convert text to speech and send to Twilio
 */
async function speakMessage(
  sessionId: string,
  text: string,
  speaker: string
): Promise<void> {
  const state = activeCalls.get(sessionId)
  if (!state) return

  state.isSpeaking = true

  try {
    // Add to transcript
    appendTranscript(sessionId, `${speaker}: ${text}`)
    broadcastTranscriptUpdate(sessionId, `${speaker}: ${text}`)

    // Generate speech with ElevenLabs
    const mp3Buffer = await textToSpeech(text)

    // Convert to μ-law for Twilio
    const mulawBuffer = await mp3ToMulaw(mp3Buffer)
    const base64Audio = mulawBuffer.toString('base64')

    // Send to Twilio in chunks (Twilio prefers smaller chunks)
    const chunkSize = 1600 // ~200ms of audio at 8kHz
    for (let i = 0; i < base64Audio.length; i += chunkSize) {
      const chunk = base64Audio.slice(i, i + chunkSize)
      const message = {
        event: 'media',
        streamSid: state.streamSid,
        media: {
          payload: chunk,
        },
      }

      if (state.twilioWs.readyState === WebSocket.OPEN) {
        state.twilioWs.send(JSON.stringify(message))
      }

      // Small delay between chunks
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  } catch (error) {
    console.error('[conversation] Error speaking message:', error)
  } finally {
    state.isSpeaking = false
  }
}

/**
 * Broadcast transcript update to frontend WebSocket clients
 */
function broadcastTranscriptUpdate(sessionId: string, line: string): void {
  broadcastTranscript(sessionId, line)
  console.log(`[conversation] Transcript: ${line}`)
}

/**
 * Handle call end
 */
export function endCall(sessionId: string): void {
  console.log(`[conversation] Ending call for session ${sessionId}`)

  const state = activeCalls.get(sessionId)
  if (state) {
    if (state.silenceTimeout) {
      clearTimeout(state.silenceTimeout)
    }
    activeCalls.delete(sessionId)
  }

  updateSession(sessionId, { status: 'completed' })
  broadcastCallEnd(sessionId)
}

/**
 * Get active call state (for debugging)
 */
export function getCallState(sessionId: string): CallState | undefined {
  return activeCalls.get(sessionId)
}

/**
 * ElevenLabs service for text-to-speech voice generation.
 * Converts AI-generated text into natural-sounding speech audio.
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY || '',
})

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB' // Adam voice

/**
 * Convert text to speech using ElevenLabs
 * Returns audio as a Buffer (MP3 format)
 */
export async function textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
  try {
    const audio = await elevenlabs.textToSpeech.convert(voiceId || DEFAULT_VOICE_ID, {
      text,
      model_id: 'eleven_turbo_v2_5', // Fast, low-latency model
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    })

    // Convert ReadableStream to Buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of audio) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  } catch (error) {
    console.error('[elevenlabs] Error generating speech:', error)
    throw error
  }
}

/**
 * Convert text to speech and return as base64-encoded μ-law audio for Twilio
 * Twilio expects 8-bit μ-law format at 8000 Hz
 */
export async function textToSpeechForTwilio(text: string, voiceId?: string): Promise<string> {
  const mp3Buffer = await textToSpeech(text, voiceId)

  // Note: We'll need to convert MP3 to μ-law PCM format
  // This will be handled by the audio utilities
  return mp3Buffer.toString('base64')
}

/**
 * Get list of available voices
 */
export async function getVoices() {
  try {
    const voices = await elevenlabs.voices.getAll()
    return voices.voices
  } catch (error) {
    console.error('[elevenlabs] Error fetching voices:', error)
    throw error
  }
}

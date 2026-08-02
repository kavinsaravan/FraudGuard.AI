/**
 * Audio format conversion utilities.
 * Handles conversion between Twilio's μ-law format and formats needed for AI services.
 */

import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { Readable, Writable } from 'stream'

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

/**
 * Convert μ-law audio (from Twilio) to WAV PCM format for transcription
 * Twilio sends: 8-bit μ-law, 8000 Hz, mono
 * Groq Whisper expects: WAV, PCM, preferably 16000 Hz or higher
 */
export async function mulawToWav(mulawBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    const inputStream = Readable.from(mulawBuffer)
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    })

    ffmpeg(inputStream)
      .inputFormat('mulaw')
      .inputOptions(['-ar 8000', '-ac 1']) // 8kHz, mono
      .audioCodec('pcm_s16le') // PCM 16-bit little-endian
      .audioFrequency(16000) // Upsample to 16kHz for better transcription
      .audioChannels(1)
      .format('wav')
      .on('error', (err) => {
        console.error('[audio] μ-law to WAV conversion error:', err)
        reject(err)
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      .pipe(outputStream)
  })
}

/**
 * Convert MP3 audio (from ElevenLabs) to μ-law format for Twilio
 * ElevenLabs returns: MP3
 * Twilio expects: 8-bit μ-law, 8000 Hz, mono, base64-encoded
 */
export async function mp3ToMulaw(mp3Buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    const inputStream = Readable.from(mp3Buffer)
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    })

    ffmpeg(inputStream)
      .inputFormat('mp3')
      .audioCodec('pcm_mulaw')
      .audioFrequency(8000)
      .audioChannels(1)
      .format('mulaw')
      .on('error', (err) => {
        console.error('[audio] MP3 to μ-law conversion error:', err)
        reject(err)
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      .pipe(outputStream)
  })
}

/**
 * Accumulate audio chunks from Twilio Media Stream
 * Twilio sends 20ms chunks of μ-law audio as base64
 */
export class AudioAccumulator {
  private chunks: Buffer[] = []
  private readonly minDuration: number // in milliseconds
  private readonly sampleRate: number = 8000 // Twilio uses 8kHz

  constructor(minDurationMs: number = 1000) {
    this.minDuration = minDurationMs
  }

  /**
   * Add an audio chunk (base64-encoded μ-law from Twilio)
   */
  addChunk(base64Audio: string): void {
    const buffer = Buffer.from(base64Audio, 'base64')
    this.chunks.push(buffer)
  }

  /**
   * Get accumulated duration in milliseconds
   */
  getDuration(): number {
    const totalBytes = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    // μ-law is 8-bit, so 1 byte = 1 sample
    // duration = samples / sample_rate
    return (totalBytes / this.sampleRate) * 1000
  }

  /**
   * Check if we have enough audio to process
   */
  hasEnoughAudio(): boolean {
    return this.getDuration() >= this.minDuration
  }

  /**
   * Get all accumulated audio as a single buffer and reset
   */
  flush(): Buffer {
    const combined = Buffer.concat(this.chunks)
    this.chunks = []
    return combined
  }

  /**
   * Reset the accumulator
   */
  reset(): void {
    this.chunks = []
  }
}

/**
 * Detect silence in audio (simple energy-based detection)
 * Useful for knowing when user has stopped speaking
 */
export function detectSilence(audioBuffer: Buffer, threshold: number = 500): boolean {
  if (audioBuffer.length === 0) return true

  // Calculate RMS energy
  let sum = 0
  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = audioBuffer[i] - 128 // μ-law is unsigned, center around 0
    sum += sample * sample
  }
  const rms = Math.sqrt(sum / audioBuffer.length)

  return rms < threshold
}

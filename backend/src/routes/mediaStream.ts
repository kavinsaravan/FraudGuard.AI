/**
 * Twilio Media Streams WebSocket handler.
 * Handles bidirectional audio streaming between Twilio and our AI conversation manager.
 */

import { WebSocket } from 'ws'
import { initializeCall, handleIncomingAudio, endCall } from '../services/conversationManager.js'

interface TwilioMediaStreamMessage {
  event: 'connected' | 'start' | 'media' | 'stop'
  streamSid?: string
  start?: {
    streamSid: string
    accountSid: string
    callSid: string
    customParameters: Record<string, string>
  }
  media?: {
    track: 'inbound' | 'outbound'
    chunk: string
    timestamp: string
    payload: string
  }
}

/**
 * Handle Twilio Media Stream WebSocket connection
 */
export function handleMediaStreamConnection(ws: WebSocket, url: string): void {
  console.log('[mediaStream] New WebSocket connection')

  let sessionId: string | null = null
  let streamSid: string | null = null

  ws.on('message', async (data: Buffer) => {
    try {
      const message: TwilioMediaStreamMessage = JSON.parse(data.toString())

      switch (message.event) {
        case 'connected':
          console.log('[mediaStream] Connected event received')
          break

        case 'start':
          if (message.start) {
            streamSid = message.start.streamSid
            sessionId = message.start.customParameters?.sessionId || null

            console.log(
              `[mediaStream] Stream started: ${streamSid}, Session: ${sessionId}`
            )

            // Store streamSid on the WebSocket object for later use
            ws['streamSid'] = streamSid

            if (sessionId) {
              // Initialize the AI conversation
              await initializeCall(sessionId, ws)
            } else {
              console.error('[mediaStream] No sessionId in custom parameters!')
            }
          }
          break

        case 'media':
          if (message.media && message.media.track === 'inbound' && sessionId) {
            // Incoming audio from the user
            await handleIncomingAudio(sessionId, message.media.payload)
          }
          break

        case 'stop':
          console.log(`[mediaStream] Stream stopped: ${streamSid}`)
          if (sessionId) {
            endCall(sessionId)
          }
          break

        default:
          console.log(`[mediaStream] Unknown event: ${message.event}`)
      }
    } catch (error) {
      console.error('[mediaStream] Error processing message:', error)
    }
  })

  ws.on('close', () => {
    console.log(`[mediaStream] WebSocket closed for stream ${streamSid}`)
    if (sessionId) {
      endCall(sessionId)
    }
  })

  ws.on('error', (error) => {
    console.error('[mediaStream] WebSocket error:', error)
    if (sessionId) {
      endCall(sessionId)
    }
  })
}

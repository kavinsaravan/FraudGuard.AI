/**
 * Transcript broadcaster - manages frontend WebSocket connections
 * and broadcasts real-time transcript updates to connected clients.
 */

import { WebSocket } from 'ws'

// Map of sessionId -> Set of WebSocket connections
const sessionConnections = new Map<string, Set<WebSocket>>()

/**
 * Register a frontend WebSocket connection for a session
 */
export function registerConnection(sessionId: string, ws: WebSocket): void {
  if (!sessionConnections.has(sessionId)) {
    sessionConnections.set(sessionId, new Set())
  }
  sessionConnections.get(sessionId)!.add(ws)

  console.log(`[broadcaster] Registered connection for session ${sessionId}`)

  // Remove on close
  ws.on('close', () => {
    unregisterConnection(sessionId, ws)
  })
}

/**
 * Unregister a WebSocket connection
 */
export function unregisterConnection(sessionId: string, ws: WebSocket): void {
  const connections = sessionConnections.get(sessionId)
  if (connections) {
    connections.delete(ws)
    if (connections.size === 0) {
      sessionConnections.delete(sessionId)
    }
  }

  console.log(`[broadcaster] Unregistered connection for session ${sessionId}`)
}

/**
 * Broadcast a transcript line to all connected clients for a session
 */
export function broadcastTranscript(sessionId: string, line: string): void {
  const connections = sessionConnections.get(sessionId)
  if (!connections || connections.size === 0) {
    return
  }

  const message = JSON.stringify({ line })

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  })

  console.log(`[broadcaster] Sent to ${connections.size} clients: ${line}`)
}

/**
 * Signal that the call has ended to all connected clients
 */
export function broadcastCallEnd(sessionId: string): void {
  const connections = sessionConnections.get(sessionId)
  if (!connections || connections.size === 0) {
    return
  }

  const message = JSON.stringify({ done: true })

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
      ws.close(1000, 'Call ended')
    }
  })

  sessionConnections.delete(sessionId)
  console.log(`[broadcaster] Call ended for session ${sessionId}`)
}

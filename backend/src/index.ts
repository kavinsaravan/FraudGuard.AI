/**
 * FraudGuard API — Express server with CORS, session routes, Twilio Media Streams, WebSocket.
 * Port from env (default 8080). Load env via dotenv.
 */

import './env.js'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import sessionsRouter from './routes/sessions.js'
import twilioRouter from './routes/twilio.js'
import { handleWsConnection } from './routes/ws.js'
import { handleMediaStreamConnection } from './routes/mediaStream.js'

const PORT = Number(process.env.PORT) || 8080
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: WEB_ORIGIN }))
app.use(express.json())

app.use('/api/sessions', sessionsRouter)
app.use('/api/twilio', twilioRouter)

const server = createServer(app)

// WebSocket for frontend live transcript
const frontendWss = new WebSocketServer({ noServer: true, perMessageDeflate: false })
frontendWss.on('connection', (ws, req) => {
  handleWsConnection(ws, req.url ?? '')
})

// WebSocket for Twilio Media Streams
const mediaStreamWss = new WebSocketServer({ noServer: true, perMessageDeflate: false })
mediaStreamWss.on('connection', (ws, req) => {
  handleMediaStreamConnection(ws, req.url ?? '')
})

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url?.split('?')[0]
  const target = pathname === '/ws' ? frontendWss :
    pathname === '/media-stream' ? mediaStreamWss : null

  if (!target) {
    socket.destroy()
    return
  }

  target.handleUpgrade(req, socket, head, (ws) => {
    target.emit('connection', ws, req)
  })
})

server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
  console.log(`Frontend WebSocket on ws://localhost:${PORT}/ws`)
  console.log(`Twilio Media Stream on ws://localhost:${PORT}/media-stream`)
  console.log(`Groq API Key configured: ${Boolean(process.env.GROQ_API_KEY)}`)
  console.log(`ElevenLabs API Key configured: ${Boolean(process.env.ELEVENLABS_API_KEY)}`)
})

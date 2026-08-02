/**
 * Twilio voice webhook with Media Streams integration.
 * Establishes bidirectional audio stream for AI-powered conversation.
 */

import { Router, Request, Response } from 'express'

const router = Router()

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || ''

router.post('/voice', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined

  if (!sessionId) {
    res.type('application/xml')
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response><Say>Error: Missing session ID.</Say></Response>'
    )
    return
  }

  // Check if we have API keys configured for AI features
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY)
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY)

  if (!hasGroqKey || !hasElevenLabsKey) {
    // Fallback to simple message if AI services not configured
    res.type('application/xml')
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response><Say>This is a test scam call. AI services are not configured yet.</Say></Response>'
    )
    return
  }

  // Construct WebSocket URL for Media Streams
  const wsUrl = PUBLIC_BASE_URL.replace(/^http/, 'ws') + '/media-stream'

  // Generate TwiML with Media Stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="sessionId" value="${sessionId}" />
    </Stream>
  </Connect>
</Response>`

  res.type('application/xml')
  res.send(twiml)
})

export default router

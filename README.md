# FraudGuard.AI

FraudGuard.AI is a scam-call simulation and debrief app. This repo contains the monorepo (frontend + backend).

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + TypeScript
- **Live transcript:** WebSocket
- **Storage:** In-memory session store (no database yet)
- **Twilio:** Outbound training calls and bidirectional Media Streams
- **Config:** Environment variables via dotenv

## How to Install

Use Node.js 22.12 or later.

```bash
# From repo root
npm run install:all
```

This installs dependencies for the root package, `frontend`, and `backend`.

## How to Run Locally

1. Install all deps:
   ```bash
   npm run install:all
   ```
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Start both frontend and backend:
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - API: http://localhost:8080

   The API reads the root `.env`. Values in `backend/.env`, if present, take precedence over the root file.

4. Open the Home page, enter a phone number, pick a scenario, and start a session. The Live page streams the transcript and opens the Debrief after the session ends. With the example environment settings, the session uses a scripted transcript.

Use `npm run dev:dashboard` to open the separate dashboard app in `src/`.

## Real AI Phone Calls Setup

- Makes real phone calls using Twilio
- Interactive AI conversations using Groq LLM
- Convert text to natural speech using ElevenLabs
- Transcribe user speech in real-time using Groq Whisper
- Stream live transcripts to the frontend

### Quick Setup

1. Get API keys from:
   - [Twilio](https://www.twilio.com) - Phone calls
   - [Groq](https://console.groq.com) - AI conversation & transcription (FREE)
   - [ElevenLabs](https://elevenlabs.io) - Voice synthesis

2. Add them to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_FROM_NUMBER=+1234567890
   GROQ_API_KEY=gsk_xxxxx
   ELEVENLABS_API_KEY=xxxxx
   ```

3. Use ngrok to expose your local server:
   ```bash
   ngrok http 8080
   ```

4. Add ngrok URL to `.env`:
   ```env
   PUBLIC_BASE_URL=https://abc123.ngrok-free.app
   ```

**📚 For detailed setup instructions, see [SETUP_AI_CALLS.md](./SETUP_AI_CALLS.md)**

### Simulation Mode

Without API keys, the app runs in simulation mode with mock transcript streaming (no real calls).

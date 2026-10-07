# FraudGuard.AI

FraudGuard.AI is a scam-call simulation and debrief app. This repo contains the monorepo (frontend + backend).

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + TypeScript
- **Live transcript:** WebSocket
- **Storage:** In-memory session store (no database yet)
- **Twilio:** Placeholder integration for voice webhooks
- **Config:** Environment variables via dotenv

## How to Install

```bash
# From repo root
npm run install:all
# or
npm install
```

This installs dependencies for the root workspace and for `frontend` and `backend`.

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

   If Twilio creds are set in `.env`, starting a session places a real outbound call to the phone number.

3. **Optional:** Use the Home page to enter a phone number, pick a scenario, and click Start. You’ll be taken to the Live page (streaming transcript), then after 10 seconds to the Debrief page (score + transcript + risk label).

## Real AI Phone Calls Setup

🎉 **NEW:** Real AI-powered phone calls are now implemented!

The app can now:
- Make real phone calls using Twilio
- Have interactive AI conversations using Groq LLM
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

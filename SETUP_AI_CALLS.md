# FraudGuard.AI - Real AI Phone Call Setup Guide

This guide walks you through setting up **real AI-powered scam phone calls** using Twilio, Groq, and ElevenLabs.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [API Keys Setup](#api-keys-setup)
3. [Environment Configuration](#environment-configuration)
4. [Testing Locally with ngrok](#testing-locally-with-ngrok)
5. [How It Works](#how-it-works)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- A phone number to test with
- Credit card for API services (most have free tiers)

---

## API Keys Setup

### 1. Twilio (Phone Calls)

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Get a phone number with voice capabilities
3. Find your credentials in the Twilio Console:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**
   - **From Number** (your Twilio phone number, format: `+1234567890`)

**Cost:** $1/month for phone number + ~$0.01/minute for calls
**Free Trial:** $15 credit to start

### 2. Groq (AI Conversation & Speech-to-Text)

1. Sign up at [console.groq.com](https://console.groq.com)
2. Navigate to **API Keys** section
3. Create a new API key

**Cost:** Free tier includes 14,400 requests/day
**Models Used:**
- `llama-3.3-70b-versatile` for conversation
- `whisper-large-v3-turbo` for speech-to-text

### 3. ElevenLabs (Text-to-Speech)

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Go to **Profile** → **API Keys**
3. Copy your API key
4. (Optional) Go to **Voices** and copy a voice ID you like
   - Default voice: `pNInz6obpgDQGcFmaJgB` (Adam)
   - Or browse the voice library and copy any voice ID

**Cost:** Free tier includes 10,000 characters/month (~15-20 minutes of speech)
**Paid:** $5/month for 30,000 characters, $22/month for 100,000 characters

### 4. ngrok (Local Webhook Tunnel)

1. Sign up at [ngrok.com](https://ngrok.com)
2. Download and install ngrok
3. Authenticate: `ngrok authtoken YOUR_AUTH_TOKEN`

**Cost:** Free tier works fine for development

---

## Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```bash
   # API server
   PORT=8080

   # Frontend origin for CORS
   WEB_ORIGIN=http://localhost:5173

   # Twilio (for voice webhooks and Media Streams)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_FROM_NUMBER=+1234567890

   # Public URL for webhooks (e.g. ngrok URL) - leave blank for now
   PUBLIC_BASE_URL=

   # Groq API (for LLM conversation and Whisper STT)
   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

   # ElevenLabs API (for text-to-speech voice generation)
   ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
   ```

3. Save the file

---

## Testing Locally with ngrok

Since Twilio needs to send webhooks to your server, you need to expose your local server to the internet using ngrok.

### Step 1: Start the Backend

```bash
cd backend
npm install
npm run dev
```

You should see:
```
API listening on http://localhost:8080
Frontend WebSocket on ws://localhost:8080/ws
Twilio Media Stream on ws://localhost:8080/media-stream
Groq API Key configured: true
ElevenLabs API Key configured: true
```

### Step 2: Start ngrok

In a **new terminal**:

```bash
ngrok http 8080
```

You'll see output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8080
```

### Step 3: Update Environment Variable

1. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok-free.app`)
2. Add it to your `.env` file:
   ```bash
   PUBLIC_BASE_URL=https://abc123.ngrok-free.app
   ```
3. Restart the backend server (Ctrl+C, then `npm run dev` again)

### Step 4: Start the Frontend

In a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Step 5: Test a Real Call!

1. Go to http://localhost:5173
2. Enter your phone number
3. Select a scam scenario
4. Click **"Start training call"**
5. Your phone should ring within 10 seconds!
6. Answer and have a conversation with the AI scammer
7. Watch the live transcript update in real-time
8. After the call ends, view your vulnerability score

---

## How It Works

### Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   Browser   │◄───────►│   Frontend   │◄───────►│  Backend   │
│  (React)    │   HTTP  │  (Vite)      │   WS    │  (Express) │
└─────────────┘         └──────────────┘         └────────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    │                   │                   │
                                    ▼                   ▼                   ▼
                            ┌──────────────┐    ┌──────────┐      ┌──────────────┐
                            │    Twilio    │    │   Groq   │      │  ElevenLabs  │
                            │ Media Stream │    │ LLM+STT  │      │     TTS      │
                            └──────────────┘    └──────────┘      └──────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │  Your Phone  │
                            └──────────────┘
```

### Call Flow

1. **User initiates call:**
   - Frontend sends POST `/api/sessions/start` with phone number and scenario
   - Backend creates session and calls Twilio API to place outbound call

2. **Twilio receives call:**
   - Twilio calls webhook: `POST /api/twilio/voice?sessionId=xxx`
   - Backend returns TwiML with Media Stream WebSocket URL
   - Twilio establishes WebSocket connection to `/media-stream`

3. **AI conversation begins:**
   - Backend generates opening message using Groq LLM
   - ElevenLabs converts text to speech (MP3)
   - Backend converts MP3 to μ-law audio format
   - Audio is sent to Twilio, which plays it to the user

4. **User speaks:**
   - Twilio streams raw audio (μ-law) via WebSocket
   - Backend accumulates audio chunks until silence detected
   - Audio is converted to WAV format
   - Groq Whisper transcribes speech to text
   - Transcript is broadcast to frontend via WebSocket

5. **AI responds:**
   - User's message is sent to Groq LLM with conversation history
   - LLM generates scammer response based on scenario prompts
   - Response is converted to speech and played back
   - Cycle repeats until call ends

6. **Call ends:**
   - Session is marked as completed
   - Backend runs scoring algorithm on full transcript
   - Frontend shows debrief page with score and recommendations

### Key Components

- **`backend/src/services/groq.ts`** - Groq API integration (LLM + Whisper STT)
- **`backend/src/services/elevenlabs.ts`** - ElevenLabs TTS integration
- **`backend/src/services/conversationManager.ts`** - Orchestrates call flow
- **`backend/src/routes/mediaStream.ts`** - Twilio Media Stream WebSocket handler
- **`backend/src/utils/audio.ts`** - Audio format conversion (μ-law ↔ PCM ↔ MP3)
- **`backend/src/services/transcriptBroadcaster.ts`** - Real-time transcript to frontend

---

## Troubleshooting

### "API services are not configured yet"

- **Cause:** Missing Groq or ElevenLabs API keys
- **Fix:** Add `GROQ_API_KEY` and `ELEVENLABS_API_KEY` to `.env`

### Phone doesn't ring

- **Cause:** Twilio credentials incorrect or PUBLIC_BASE_URL not set
- **Fix:**
  1. Verify Twilio credentials in `.env`
  2. Make sure ngrok is running
  3. Verify `PUBLIC_BASE_URL` matches your ngrok URL
  4. Check backend logs for errors

### Call connects but no AI voice

- **Cause:** ElevenLabs API key invalid or quota exceeded
- **Fix:**
  1. Check ElevenLabs API key
  2. Verify you haven't exceeded free tier (10k chars/month)
  3. Check backend logs for errors

### Transcription not working

- **Cause:** Groq API key invalid or audio format issues
- **Fix:**
  1. Check Groq API key
  2. Look for FFmpeg errors in logs (audio conversion)
  3. Ensure FFmpeg is installed (included via npm)

### Audio quality is poor

- **Adjustments:**
  1. Try a different ElevenLabs voice ID
  2. Adjust voice settings in `backend/src/services/elevenlabs.ts`
  3. Modify silence detection threshold in `backend/src/utils/audio.ts`

### High API costs

- **Cost optimization:**
  1. Use shorter prompts for LLM (reduce token usage)
  2. Limit call duration (add timeout in conversation manager)
  3. Use simulation mode for testing (no API calls)

### ngrok URL keeps changing

- **Solution:**
  1. Upgrade to ngrok paid plan for static domain
  2. Or update `.env` and restart backend each time ngrok URL changes

---

## Simulation Mode (No API Keys Required)

If you don't have API keys yet, the app falls back to **simulation mode**:

- Frontend streams mock transcript lines
- No real phone call is placed
- Perfect for testing the UI and flow

To use simulation mode, just leave API keys blank in `.env`.

---

## Additional Resources

- [Twilio Media Streams Docs](https://www.twilio.com/docs/voice/media-streams)
- [Groq API Docs](https://console.groq.com/docs)
- [ElevenLabs API Docs](https://elevenlabs.io/docs/api-reference/overview)
- [ngrok Documentation](https://ngrok.com/docs)

---

## Support

If you encounter issues:

1. Check backend logs for error messages
2. Verify all API keys are correct
3. Ensure ngrok is running and PUBLIC_BASE_URL is set
4. Test each API service individually (see service files for standalone usage)

---

**Happy Testing! Be careful not to actually scam yourself!** 😄

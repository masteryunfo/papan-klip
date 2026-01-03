# Clipboard PIN Relay

A minimal Next.js (App Router) app for relaying text from a phone to a computer with temporary storage and optional client-side PIN encryption.

## Features
- Vercel-ready serverless API routes.
- Upstash Redis storage with TTL (default 30 minutes).
- One-time read via atomic Redis Lua script.
- Optional PIN-based encryption in the browser (PBKDF2 + AES-GCM).
- QR code pairing for quick send links.

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment variables
Create a `.env.local` file (or set in Vercel):
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
MESSAGE_TTL_SECONDS=1800
BASE_URL=https://your-domain.vercel.app
```

- `MESSAGE_TTL_SECONDS` defaults to `1800` when omitted.
- `BASE_URL` is optional and only used to generate absolute QR URLs.

### 3) Run locally
```bash
npm run dev
```

Open:
- `http://localhost:3000/receive` on your computer.
- Scan the QR code or open the `send` page on your phone.

## API Endpoints
- `POST /api/session` → creates a session and returns `{ token, short_code, qr_url }`.
- `POST /api/send` → store a message (plaintext or encrypted payload).
- `POST /api/receive` → atomically fetch-and-delete the stored message.

## Notes
- Plaintext messages are limited to 50KB.
- The server never receives or stores the PIN.

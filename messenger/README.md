# 💬 Full-Featured Web Messenger

A production-ready messenger application with real-time chat, file sharing, presence indicators, delivery receipts, and admin tools.

## ✨ Features

- **Real-time messaging** — 1:1 and group chat via WebSocket/Socket.IO
- **Authentication** — Email/password + JWT with refresh tokens + optional Google OAuth
- **User profiles** — Display name, avatar, bio, and status
- **Presence** — Online/away/busy/offline with live updates
- **Typing indicators** — Real-time "X is typing..." feedback
- **Message persistence** — PostgreSQL with full message history
- **File attachments** — Images and files via S3/MinIO with presigned URLs
- **Delivery receipts** — Sent ✓ / Delivered ✓✓ / Read 🔵✓✓ status
- **Ephemeral messages** — Optional TTL for auto-expiring messages
- **Auto-translate** — Stubbed integration with Google Translate / DeepL
- **Content moderation** — Stubbed integration with OpenAI Moderation API
- **Admin UI** — User management, ban/unban, moderation queue
- **Rate limiting** — Per-IP and per-endpoint rate limits
- **Input validation & XSS protection** — All inputs sanitized

## 🚀 Quick Start (Docker)

```bash
# 1. Clone / unzip and enter directory
cd full-messenger-app

# 2. Copy environment file
cp .env.example .env

# 3. Build and start everything
docker-compose up --build

# 4. Open the app
open http://localhost:3000
```

That's it! The first start will:
1. Start PostgreSQL, Redis, and MinIO
2. Run database migrations automatically
3. Seed sample test accounts
4. Start the backend API (port 3001) and frontend (port 3000)

## 🔑 Test Accounts

After running `docker-compose up --build`, these accounts are available:

| Email | Password | Role |
|-------|----------|------|
| `alice@messenger.local` | `Alice1234!` | User |
| `bob@messenger.local` | `Bob1234!` | User |
| `carol@messenger.local` | `Carol1234!` | User |
| `admin@messenger.local` | `Admin1234!` | Admin |

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────────────────────────────┐
│   Browser   │────▶│  Nginx (port 3000)                  │
│   React +   │     │  ├── /            → React SPA       │
│   TS        │     │  ├── /api/*       → Backend (3001)  │
└─────────────┘     │  └── /socket.io/* → Backend WS      │
                    └────────────────────────────────────-─┘
                           │
                    ┌──────▼──────────────────────────────┐
                    │  Express + Socket.IO (port 3001)     │
                    │  TypeScript / Node.js 20             │
                    └──────┬─────────────┬────────────────┘
                           │             │
                    ┌──────▼───┐   ┌─────▼───────┐   ┌───────┐
                    │ Postgres │   │    Redis     │   │ MinIO │
                    │ (data)   │   │ (sessions,  │   │ (files│
                    │          │   │  presence)  │   │  S3)  │
                    └──────────┘   └─────────────┘   └───────┘
```

## 🔌 Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | `3000` | React app via Nginx |
| Backend | `3001` | Express API + Socket.IO |
| PostgreSQL | `5432` | Database |
| Redis | `6379` | Cache + pub/sub |
| MinIO API | `9000` | S3-compatible file storage |
| MinIO Console | `9001` | MinIO web UI |

## 📁 Project Structure

```
messenger/
├── backend/
│   ├── src/
│   │   ├── auth/           # JWT auth: register, login, refresh
│   │   ├── users/          # Profile management, presence
│   │   ├── rooms/          # Room create/list/manage
│   │   ├── messages/       # Message CRUD + moderation hooks
│   │   ├── admin/          # Admin: ban users, moderation queue
│   │   ├── uploads/        # S3 presigned URL generation
│   │   ├── services/
│   │   │   ├── socket.service.ts    # Socket.IO events
│   │   │   ├── moderation.service.ts # Moderation stub/integration
│   │   │   └── translation.service.ts # Translation stub/integration
│   │   ├── config/         # DB, Redis, Passport config
│   │   ├── middleware/      # Auth, validation, error handling
│   │   └── migrations/     # Schema SQL + seed data
│   ├── tests/              # Jest integration tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/          # Login, Register, Chat, Profile, Admin
│   │   ├── components/
│   │   │   └── chat/       # RoomList, ChatWindow, MessageBubble
│   │   ├── services/       # API client (axios), Socket.IO client
│   │   ├── store/          # Zustand auth store
│   │   └── types/          # TypeScript interfaces
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🤖 Wiring Real AI Providers

### Translation

Edit `backend/src/services/translation.service.ts`:

**Google Cloud Translate:**
```bash
npm install @google-cloud/translate
```
```env
TRANSLATION_PROVIDER=google
GOOGLE_TRANSLATE_API_KEY=your-api-key
```

**DeepL:**
```bash
npm install deepl-node
```
```env
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your-api-key
```

### Content Moderation

Edit `backend/src/services/moderation.service.ts`:

**OpenAI Moderation API:**
```bash
npm install openai
```
```env
MODERATION_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Users can set `preferred_lang` in their profile to receive auto-translated messages. Translations are stored per-message per-language with confidence scores.

### Google OAuth

1. Create OAuth credentials at [Google Console](https://console.cloud.google.com/apis/credentials)
2. Add redirect URI: `http://your-domain/api/auth/google/callback`
3. Set in `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## 🗄️ Database Schema

Key tables:
- **`users`** — Accounts, profiles, presence status, preferred language
- **`rooms`** — Conversations (direct or group)
- **`room_members`** — Many-to-many user-room with role, last_read_at
- **`messages`** — Messages with delivery status, TTL, attachments
- **`message_translations`** — Per-language translations with confidence
- **`moderation_queue`** — Messages flagged for human review

Full schema: `backend/src/migrations/schema.sql`

## 🧪 Running Tests

```bash
# Inside backend container
docker-compose exec backend npm test

# Or locally
cd backend
npm install
npm test
```

## 🔧 Local Development (Without Docker)

```bash
# Start infrastructure
docker-compose up postgres redis minio minio-init -d

# Backend
cd backend
npm install
cp ../.env.example .env   # Edit DB_HOST=localhost etc.
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## 🔒 Security Notes

- **JWT secrets**: Always set `JWT_SECRET` to a long random string in production
- **HTTPS**: Use a reverse proxy (Caddy, nginx, Traefik) with TLS in production
- **Rate limiting**: Auth endpoints: 20 req/15min; Global: 500 req/15min
- **Input validation**: All inputs validated with `express-validator`
- **XSS prevention**: Message content sanitized with `xss` library
- **CORS**: Configured via `CORS_ORIGIN` env var
- **No secrets committed**: All secrets via environment variables

## 📦 Creating the ZIP

If you need to recreate the ZIP:

```bash
# From the parent directory of the messenger folder
zip -r full-messenger-app.zip messenger/ \
  --exclude "messenger/*/node_modules/*" \
  --exclude "messenger/*/.git/*" \
  --exclude "messenger/*/dist/*" \
  --exclude "messenger/*/.env"
```

## 🏁 Acceptance Criteria Checklist

- [x] Real-time 1:1 and group chat via WebSocket/Socket.IO
- [x] Email/password authentication with JWT + refresh tokens
- [x] Google OAuth integration point (requires credentials in .env)
- [x] User profiles: display name, avatar, status, bio
- [x] Presence (online/offline/away/busy) with live broadcasts
- [x] Typing indicators
- [x] Message persistence (PostgreSQL)
- [x] File/image attachments via S3/MinIO presigned URLs
- [x] Auto-translate stubs (callable, documented how to wire real providers)
- [x] Content moderation stubs (callable, documented how to wire real providers)
- [x] Delivery receipts (sent/delivered/read) with visual indicators
- [x] Ephemeral messages with TTL support
- [x] Admin UI (user management, ban/unban, moderation queue)
- [x] Rate limiting on all endpoints
- [x] Input validation and XSS sanitization
- [x] Dockerfiles + docker-compose for full local stack
- [x] .env.example with all variables documented
- [x] Database schema SQL with migrations runner
- [x] Sample data seeding script with test accounts
- [x] Unit/integration tests for critical backend routes
- [x] README with setup, run, and test instructions

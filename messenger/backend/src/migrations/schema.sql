-- ============================================================
-- Messenger App Database Schema
-- Run with: psql -U postgres -d messenger -f schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT,
  google_id       VARCHAR(255),
  display_name    VARCHAR(100) NOT NULL,
  avatar_url      TEXT,
  bio             VARCHAR(200),
  status          VARCHAR(20) NOT NULL DEFAULT 'offline'
                    CHECK (status IN ('online', 'away', 'busy', 'offline')),
  preferred_lang  VARCHAR(10),  -- e.g., 'es', 'fr' for auto-translation
  role            VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin', 'moderator')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_banned       BOOLEAN NOT NULL DEFAULT false,
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users USING gin(display_name gin_trgm_ops);

-- ── Rooms (conversations) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            VARCHAR(10) NOT NULL DEFAULT 'direct'
                    CHECK (type IN ('direct', 'group')),
  name            VARCHAR(100),
  avatar_url      TEXT,
  created_by      UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Room Members ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_read_at TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id, is_active);

-- ── Messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT,
  attachment_url  TEXT,
  attachment_type VARCHAR(20) CHECK (attachment_type IN ('image', 'file')),
  reply_to_id     UUID REFERENCES messages(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'delivered', 'read')),
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ,  -- For ephemeral/TTL messages
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;

-- ── Message Translations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS message_translations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  language            VARCHAR(10) NOT NULL,
  translated_content  TEXT NOT NULL,
  confidence          FLOAT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, language)
);

-- ── Moderation Queue ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_queue (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reason      VARCHAR(100) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id)
);

-- ── Refresh Tokens (optional DB backup, main store is Redis) ──
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cleanup function for expired ephemeral messages ──
CREATE OR REPLACE FUNCTION cleanup_expired_messages() RETURNS void AS $$
BEGIN
  UPDATE messages SET is_deleted = true
  WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_deleted = false;
END;
$$ LANGUAGE plpgsql;

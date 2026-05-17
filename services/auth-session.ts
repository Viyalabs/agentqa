import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getAdminClient } from '@/lib/supabase'
import type { AuthConfig } from '@/types'

// AES-256-GCM — authenticated encryption; tag validates integrity on decrypt.
// SESSION_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes).
const ALGO     = 'aes-256-gcm'
const IV_BYTES = 12  // 96-bit IV recommended for GCM

function encryptionKey(): Buffer {
  const hex = process.env.SESSION_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('SESSION_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  return Buffer.from(hex, 'hex')
}

interface EncryptedBlob {
  cipher: string  // base64
  iv:     string  // base64
  tag:    string  // base64
}

function encryptSession(plaintext: string): EncryptedBlob {
  const key    = encryptionKey()
  const iv     = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    cipher: encrypted.toString('base64'),
    iv:     iv.toString('base64'),
    tag:    cipher.getAuthTag().toString('base64'),
  }
}

function decryptSession(blob: EncryptedBlob): string {
  const key    = encryptionKey()
  const deciph = createDecipheriv(ALGO, key, Buffer.from(blob.iv, 'base64'))
  deciph.setAuthTag(Buffer.from(blob.tag, 'base64'))
  return Buffer.concat([
    deciph.update(Buffer.from(blob.cipher, 'base64')),
    deciph.final(),
  ]).toString('utf8')
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SessionRecord {
  id:           string
  label:        string | null
  owner_email:  string
  session_kind: string
  login_url:    string | null
  created_at:   string
  expires_at:   string | null
  last_used_at: string | null
  use_count:    number
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createSession(
  ownerEmail: string,
  auth: AuthConfig,
  label?: string,
  expiresAt?: Date,
): Promise<SessionRecord> {
  const db   = getAdminClient()
  const blob = encryptSession(JSON.stringify(auth))

  const { data, error } = await db
    .from('scan_sessions')
    .insert({
      owner_email:    ownerEmail,
      session_kind:   auth.kind,
      label:          label ?? null,
      encrypted_data: blob.cipher,
      iv:             blob.iv,
      auth_tag:       blob.tag,
      login_url:      auth.loginUrl ?? null,
      expires_at:     expiresAt?.toISOString() ?? null,
    })
    .select('id, label, owner_email, session_kind, login_url, created_at, expires_at, last_used_at, use_count')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create session')
  return data as SessionRecord
}

/** Load and decrypt a session. Returns null if not found or expired. */
export async function loadSession(sessionId: string): Promise<AuthConfig | null> {
  const db = getAdminClient()

  const { data } = await db
    .from('scan_sessions')
    .select('encrypted_data, iv, auth_tag, expires_at, use_count')
    .eq('id', sessionId)
    .single()

  if (!data) return null
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null

  try {
    const plaintext = decryptSession({
      cipher: data.encrypted_data as string,
      iv:     data.iv as string,
      tag:    data.auth_tag as string,
    })

    // Update usage stats — fire and forget
    void db.from('scan_sessions').update({
      last_used_at: new Date().toISOString(),
      use_count:    ((data.use_count as number) ?? 0) + 1,
    }).eq('id', sessionId)

    return JSON.parse(plaintext) as AuthConfig
  } catch {
    return null
  }
}

export async function getSessionMetadata(sessionId: string): Promise<SessionRecord | null> {
  const db = getAdminClient()
  const { data } = await db
    .from('scan_sessions')
    .select('id, label, owner_email, session_kind, login_url, created_at, expires_at, last_used_at, use_count')
    .eq('id', sessionId)
    .single()
  return (data as SessionRecord | null)
}

export async function listSessions(ownerEmail: string): Promise<SessionRecord[]> {
  const db = getAdminClient()
  const { data } = await db
    .from('scan_sessions')
    .select('id, label, owner_email, session_kind, login_url, created_at, expires_at, last_used_at, use_count')
    .eq('owner_email', ownerEmail)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as SessionRecord[]
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getAdminClient().from('scan_sessions').delete().eq('id', sessionId)
}

/** Delete sessions past their expires_at — call from scheduler cron. */
export async function purgeExpiredSessions(): Promise<number> {
  const db = getAdminClient()
  const { data } = await db
    .from('scan_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')
  return (data ?? []).length
}

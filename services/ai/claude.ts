/**
 * Reusable Claude API client.
 *
 * Provides a singleton Anthropic client, typed result types, automatic retry
 * with exponential back-off, per-request timeouts, and multi-strategy JSON
 * extraction. Callers never need to handle raw SDK errors or instantiate the
 * client themselves.
 *
 * Usage:
 *   import { callClaude, callClaudeJSON, CLAUDE_HAIKU } from '@/services/ai/claude'
 */
import Anthropic, {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  InternalServerError,
} from '@anthropic-ai/sdk'
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages/messages'

// ── Model identifiers ─────────────────────────────────────────────────────────

export type ClaudeModel =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7'

export const CLAUDE_HAIKU: ClaudeModel  = 'claude-haiku-4-5-20251001'
export const CLAUDE_SONNET: ClaudeModel = 'claude-sonnet-4-6'
export const CLAUDE_OPUS: ClaudeModel   = 'claude-opus-4-7'

// ── Result and error types ────────────────────────────────────────────────────

export type ClaudeErrorCode =
  | 'config_error'   // missing/invalid API key or permissions
  | 'rate_limited'   // 429 — slow down and retry at the call site
  | 'overloaded'     // 529 — API busy, retry later
  | 'timeout'        // request exceeded its per-call timeout
  | 'api_error'      // other non-retryable HTTP error from the API
  | 'parse_error'    // response was not valid JSON (callClaudeJSON only)
  | 'network_error'  // connection-level failure

export type ClaudeError =
  | { code: 'config_error';  message: string }
  | { code: 'rate_limited';  message: string; retryAfterMs?: number }
  | { code: 'overloaded';    message: string }
  | { code: 'timeout';       message: string; timeoutMs: number }
  | { code: 'api_error';     message: string; status: number }
  | { code: 'parse_error';   message: string; raw: string }
  | { code: 'network_error'; message: string }

export type ClaudeUsage = { inputTokens: number; outputTokens: number }

export type ClaudeResult<T> =
  | { ok: true;  data: T;            usage: ClaudeUsage }
  | { ok: false; error: ClaudeError; usage?: never }

// ── Request params ────────────────────────────────────────────────────────────

export interface ClaudeCallParams {
  /** Prompt sent as the user turn. Required. */
  prompt: string
  /** Optional system prompt. */
  system?: string
  /** Model to use. Defaults to claude-haiku-4-5-20251001. */
  model?: ClaudeModel
  /** Upper bound on the response length. Defaults to 1 024 tokens. */
  maxTokens?: number
  /** Per-request wall-clock timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number
  /**
   * Maximum number of additional attempts on retryable errors (429, 529,
   * network). Does not count the original attempt. Defaults to 3.
   */
  maxRetries?: number
}

export interface ClaudeJSONParams<T> extends ClaudeCallParams {
  /**
   * Optional validator / transformer applied after JSON parsing.
   * Throw (or call Zod's `.parse`) to signal an invalid shape — the error
   * is surfaced as `{ code: 'parse_error' }`.
   *
   * Example with Zod:
   *   schema: (raw) => MyZodSchema.parse(raw)
   *
   * Example without Zod:
   *   schema: (raw) => {
   *     if (!isMyShape(raw)) throw new Error('unexpected shape')
   *     return raw as MyType
   *   }
   */
  schema?: (raw: unknown) => T
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_MODEL: ClaudeModel = CLAUDE_HAIKU
const DEFAULT_MAX_TOKENS  = 1_024
const DEFAULT_TIMEOUT_MS  = 30_000
const DEFAULT_MAX_RETRIES = 3

// Retry back-off: base × multiplier^attempt + jitter, capped at max
const BACKOFF_BASE_MS       = 1_000
const BACKOFF_MULTIPLIER    = 2
const BACKOFF_JITTER_MAX_MS = 250
const BACKOFF_CAP_MS        = 10_000

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: Anthropic | null = null

/**
 * Returns the shared Anthropic client, creating it on first call.
 * Throws a `ConfigError` if ANTHROPIC_API_KEY is absent.
 *
 * Call-time initialisation means the missing-key error is surfaced in context
 * rather than at module load time (important for Next.js where server and
 * client bundles share module boundaries).
 */
export function getClaudeClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ConfigError(
    'ANTHROPIC_API_KEY is not set. ' +
    'Add it to .env.local or your deployment environment.'
  )
  _client = new Anthropic({ apiKey })
  return _client
}

/** Returns true when ANTHROPIC_API_KEY is present in the environment. */
export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Internal sentinel so getClaudeClient() can throw a recognisable type
class ConfigError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ConfigError' }
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyError(err: unknown, timeoutMs: number): ClaudeError {
  if (err instanceof ConfigError) {
    return { code: 'config_error', message: err.message }
  }
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return {
      code: 'config_error',
      message: `Authentication failed (${(err as APIError).status}): ${err.message}`,
    }
  }
  if (err instanceof RateLimitError) {
    const retryAfterMs = parseRetryAfter(err)
    return {
      code: 'rate_limited',
      message: err.message,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    }
  }
  if (err instanceof APIError && (err as APIError).status === 529) {
    return { code: 'overloaded', message: err.message }
  }
  if (err instanceof APIUserAbortError) {
    return { code: 'timeout', message: `Request timed out after ${timeoutMs}ms.`, timeoutMs }
  }
  if (err instanceof APIConnectionTimeoutError) {
    return { code: 'timeout', message: `Connection timed out after ${timeoutMs}ms.`, timeoutMs }
  }
  if (err instanceof APIConnectionError) {
    return { code: 'network_error', message: `Connection error: ${err.message}` }
  }
  if (err instanceof InternalServerError) {
    return { code: 'api_error', message: err.message, status: (err as APIError).status as number }
  }
  if (err instanceof APIError) {
    return { code: 'api_error', message: err.message, status: (err as APIError).status as number }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return { code: 'network_error', message: msg }
}

function parseRetryAfter(err: RateLimitError): number | undefined {
  // The SDK surfaces response headers as an object on the error
  const raw = (err as unknown as { headers?: Record<string, string> }).headers?.['retry-after']
  if (!raw) return undefined
  const secs = parseFloat(raw)
  return isNaN(secs) ? undefined : secs * 1_000
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError)            return true   // 429
  if (err instanceof APIError && (err as APIError).status === 529) return true  // overloaded
  if (err instanceof InternalServerError)       return true   // 500
  if (err instanceof APIConnectionError)        return true   // network (includes timeout subclass)
  return false
  // Not retryable: AuthenticationError, BadRequestError, PermissionDeniedError,
  //                APIUserAbortError (our own per-request timeout), other 4xx
}

function backoffMs(attempt: number, err: unknown): number {
  if (err instanceof RateLimitError) {
    const suggested = parseRetryAfter(err)
    if (suggested !== undefined) return Math.min(suggested, BACKOFF_CAP_MS)
  }
  const exponential = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, attempt)
  const jitter = Math.random() * BACKOFF_JITTER_MAX_MS
  return Math.min(exponential + jitter, BACKOFF_CAP_MS)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Core request execution ────────────────────────────────────────────────────

async function executeWithRetry(
  params: MessageCreateParamsNonStreaming,
  timeoutMs: number,
  maxRetries: number,
): Promise<Message> {
  const client = getClaudeClient()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      // Disable the SDK's own retry so our loop is the single source of truth
      // for retry behaviour and structured logging.
      const message = await client.messages.create(params, {
        signal:     controller.signal,
        maxRetries: 0,
      })
      clearTimeout(timer)
      return message as Message
    } catch (err) {
      clearTimeout(timer)

      const isLast = attempt === maxRetries
      if (isLast || !isRetryable(err)) throw err

      const delay = backoffMs(attempt, err)
      const label = err instanceof APIError ? `HTTP ${(err as APIError).status}` : 'network'
      console.warn(
        `[claude] Attempt ${attempt + 1}/${maxRetries + 1} failed (${label}). ` +
        `Retrying in ${Math.round(delay)}ms…`
      )
      await sleep(delay)
    }
  }

  // Unreachable — loop always throws or returns before exhaustion
  throw new Error('[claude] Retry loop exited without result or error.')
}

// ── Public: text response ─────────────────────────────────────────────────────

/**
 * Call Claude and return the raw text response.
 *
 * Never throws. Returns `{ ok: false, error }` on any failure so callers can
 * handle errors explicitly without try/catch.
 */
export async function callClaude(
  params: ClaudeCallParams,
): Promise<ClaudeResult<string>> {
  const {
    prompt,
    system,
    model      = DEFAULT_MODEL,
    maxTokens  = DEFAULT_MAX_TOKENS,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = params

  const sdkParams: MessageCreateParamsNonStreaming = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    ...(system ? { system } : {}),
  }

  try {
    const message = await executeWithRetry(sdkParams, timeoutMs, maxRetries)
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    return {
      ok:    true,
      data:  text,
      usage: {
        inputTokens:  message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    }
  } catch (err) {
    return { ok: false, error: classifyError(err, timeoutMs) }
  }
}

// ── Public: JSON response ─────────────────────────────────────────────────────

/**
 * Call Claude expecting a JSON response.
 *
 * JSON extraction strategy (applied in order):
 *   1. Direct `JSON.parse` on the full response text
 *   2. Extract the first ` ```json … ``` ` or ` ``` … ``` ` fenced block
 *   3. Extract the first bare `{ … }` or `[ … ]` substring
 *
 * If `params.schema` is provided, the parsed value is passed through it
 * before returning. Throw inside `schema` to signal an unexpected shape.
 *
 * Returns `{ ok: false, error: { code: 'parse_error' } }` when no JSON can
 * be extracted or when the schema validator throws.
 */
export async function callClaudeJSON<T>(
  params: ClaudeJSONParams<T>,
): Promise<ClaudeResult<T>> {
  // Append a JSON instruction to guide the model away from prose wrapping.
  const augmented: ClaudeCallParams = {
    ...params,
    prompt: `${params.prompt}\n\nRespond with valid JSON only. No explanation, no markdown fences.`,
  }

  const textResult = await callClaude(augmented)
  if (!textResult.ok) return textResult

  const raw = textResult.data.trim()

  let parsed: unknown
  try {
    parsed = extractJSON(raw)
  } catch {
    return {
      ok:    false,
      error: { code: 'parse_error', message: 'Response did not contain valid JSON.', raw },
    }
  }

  if (params.schema) {
    try {
      const validated = params.schema(parsed)
      return { ok: true, data: validated, usage: textResult.usage }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Schema validation failed.'
      return {
        ok:    false,
        error: { code: 'parse_error', message: msg, raw },
      }
    }
  }

  return { ok: true, data: parsed as T, usage: textResult.usage }
}

// ── JSON extraction helpers ───────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  // Strategy 1: the entire response is valid JSON
  try { return JSON.parse(text) } catch { /* fall through */ }

  // Strategy 2: ```json … ``` or ``` … ``` fenced block
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }

  // Strategy 3: first { … } or [ … ] substring (handles leading/trailing prose)
  const bare = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (bare?.[1]) {
    try { return JSON.parse(bare[1]) } catch { /* fall through */ }
  }

  throw new SyntaxError(
    `No JSON found in response (first 200 chars): ${text.slice(0, 200)}`
  )
}

// ── Observability ─────────────────────────────────────────────────────────────

/**
 * Structured logger for `ClaudeError` values.
 *
 * @param context  Short label for the log line, e.g. `'issue-analysis'`.
 * @param error    The error object from a failed `ClaudeResult`.
 */
export function logClaudeError(context: string, error: ClaudeError): void {
  const p = `[claude:${context}]`
  switch (error.code) {
    case 'config_error':
      console.error(`${p} Configuration error — ${error.message}`)
      break
    case 'rate_limited':
      console.warn(
        `${p} Rate limited — ${error.message}` +
        (error.retryAfterMs ? ` (retry after ${error.retryAfterMs}ms)` : '')
      )
      break
    case 'overloaded':
      console.warn(`${p} API overloaded — ${error.message}`)
      break
    case 'timeout':
      console.warn(`${p} Timeout after ${error.timeoutMs}ms — ${error.message}`)
      break
    case 'api_error':
      console.error(`${p} API error ${error.status} — ${error.message}`)
      break
    case 'parse_error':
      console.error(
        `${p} JSON parse error — ${error.message}\n` +
        `Raw (200 chars): ${error.raw.slice(0, 200)}`
      )
      break
    case 'network_error':
      console.error(`${p} Network error — ${error.message}`)
      break
  }
}

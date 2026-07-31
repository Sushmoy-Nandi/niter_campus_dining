/**
 * Centralised secret resolution — the single place that decides which env var
 * backs each signed/shared secret, and the single place that FAILS CLOSED.
 *
 * Why this exists: every previous consumer inlined its own
 * `process.env.X || "some-hardcoded-string"` fallback. That is a silent
 * security hole — if the env var is ever missing in production the app keeps
 * running against a value that is committed to the repo (and therefore public).
 * Here we throw instead, so a misconfigured deploy fails loudly at the first
 * request rather than quietly accepting forged tokens forever.
 */

/**
 * Secret used to sign/verify short-lived meal QR tokens.
 *
 * Prefers AUTH_SECRET (the historical name for this flow) but falls back to
 * NEXTAUTH_SECRET — which the auth layer already requires — so a deploy only
 * has to configure ONE secret. If neither is set we throw; there is no insecure
 * default. Signer and verifier both call this, so they can never disagree.
 */
export function getQrTokenSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET (or NEXTAUTH_SECRET). Refusing to sign/verify QR tokens with an insecure default."
    )
  }
  return secret
}

/**
 * Secret guarding the read-only master-sheet export endpoints.
 * NEXT_PUBLIC_* is accepted because the Google Sheet integration reads it
 * client-side, but there is no hardcoded fallback — an unset value fails closed.
 */
export function getMasterSheetSecret(): string {
  const secret =
    process.env.MASTER_SHEET_SECRET || process.env.NEXT_PUBLIC_MASTER_SHEET_SECRET
  if (!secret) {
    throw new Error(
      "Missing MASTER_SHEET_SECRET. Refusing to expose master-sheet export with an insecure default."
    )
  }
  return secret
}

/**
 * Secret guarding the inbound bKash SMS webhook.
 * No fallback — an unset value fails closed so a forgotten env var can never
 * leave the payment-ingest endpoint open to the public.
 */
export function getBkashWebhookSecret(): string {
  const secret = process.env.BKASH_WEBHOOK_SECRET
  if (!secret) {
    throw new Error(
      "Missing BKASH_WEBHOOK_SECRET. Refusing to accept payment webhooks with an insecure default."
    )
  }
  return secret
}

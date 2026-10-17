// Outbound email for spaminthai.com (transactional only — acknowledgment of tips, etc.).
//
// Cloudflare Pages Functions cannot speak SMTP, so mail goes out through an HTTP
// email API. Two providers are supported; the first one with a key wins unless
// MAIL_PROVIDER forces a choice:
//
//   RESEND_API_KEY  → https://resend.com  (POST https://api.resend.com/emails)
//   BREVO_API_KEY   → https://brevo.com   (POST https://api.brevo.com/v3/smtp/email)
//
// Other env (all optional):
//   MAIL_FROM      "SpamInThai <admin@spaminthai.com>"  — domain must be verified at the provider
//   MAIL_REPLY_TO  "admin@spaminthai.com"
//   MAIL_BCC       "admin@spaminthai.com"                — copy every outbound mail to the team inbox
//   MAIL_PROVIDER  "resend" | "brevo"                    — override auto-detection
//
// Nothing here throws on a delivery problem: sendMail() always resolves to
// { ok, provider, id?, status?, error? } so callers can record the outcome.

export const DEFAULT_MAIL_FROM = 'SpamInThai <admin@spaminthai.com>';
export const DEFAULT_REPLY_TO = 'admin@spaminthai.com';
const SEND_TIMEOUT_MS = 8000;

// Pragmatic address check (local@domain.tld, no spaces, no angle brackets).
const EMAIL_RE = /^[^\s@<>"'(),;:[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function isEmailAddress(value) {
  const s = String(value || '').trim();
  return s.length > 5 && s.length <= 254 && EMAIL_RE.test(s);
}

/** Pull the first email address out of free text such as "line: foo / foo@bar.com". */
export function extractEmail(value) {
  const s = String(value || '');
  if (isEmailAddress(s.trim())) return s.trim().toLowerCase();
  const m = s.match(/[^\s@<>"'(),;:[\]\\]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}/);
  return m && isEmailAddress(m[0]) ? m[0].toLowerCase() : null;
}

/** Which provider would be used, or null when no API key is configured. */
export function mailProvider(env) {
  const forced = String(env?.MAIL_PROVIDER || '').trim().toLowerCase();
  if (forced === 'resend') return env?.RESEND_API_KEY ? 'resend' : null;
  if (forced === 'brevo') return env?.BREVO_API_KEY ? 'brevo' : null;
  if (env?.RESEND_API_KEY) return 'resend';
  if (env?.BREVO_API_KEY) return 'brevo';
  return null;
}

export function mailConfigured(env) {
  return mailProvider(env) !== null;
}

/** "Name <addr>" | "addr" → { name, email } */
export function parseAddress(raw, fallback = DEFAULT_MAIL_FROM) {
  const s = String(raw || fallback).trim();
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || '').trim() || null, email: m[2].trim() };
  return { name: null, email: s };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text → minimal HTML (paragraphs + line breaks) when a caller has no HTML body. */
export function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function postJson(url, headers, body, fetchImpl) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, ok: res.ok, data };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Send one email.
 * @param {object} env  Cloudflare env (API keys, MAIL_* settings)
 * @param {{to:string, subject:string, text:string, html?:string, replyTo?:string, bcc?:string|null, tags?:Record<string,string>}} msg
 * @param {{fetch?: typeof fetch}} [opts]  injectable fetch for tests
 * @returns {Promise<{ok:boolean, provider:string|null, id?:string|null, status?:number, error?:string}>}
 */
export async function sendMail(env, msg, opts = {}) {
  const provider = mailProvider(env);
  if (!provider) return { ok: false, provider: null, error: 'mail_not_configured' };

  const to = String(msg?.to || '').trim();
  if (!isEmailAddress(to)) return { ok: false, provider, error: 'invalid_recipient' };
  const subject = String(msg?.subject || '').trim();
  const text = String(msg?.text || '');
  if (!subject || !text) return { ok: false, provider, error: 'empty_message' };

  const html = msg.html || textToHtml(text);
  const from = parseAddress(env.MAIL_FROM, DEFAULT_MAIL_FROM);
  const replyTo = String(msg.replyTo || env.MAIL_REPLY_TO || DEFAULT_REPLY_TO).trim();
  const bccRaw = msg.bcc === undefined ? env.MAIL_BCC : msg.bcc;
  const bcc = bccRaw && isEmailAddress(String(bccRaw).trim()) && String(bccRaw).trim().toLowerCase() !== to.toLowerCase()
    ? String(bccRaw).trim()
    : null;
  const fetchImpl = opts.fetch || globalThis.fetch;

  try {
    if (provider === 'resend') {
      const body = {
        from: from.name ? `${from.name} <${from.email}>` : from.email,
        to: [to],
        subject,
        text,
        html,
        reply_to: replyTo,
      };
      if (bcc) body.bcc = [bcc];
      if (msg.tags) body.tags = Object.entries(msg.tags).map(([name, value]) => ({ name, value: String(value) }));
      const r = await postJson(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body,
        fetchImpl,
      );
      if (!r.ok) {
        return {
          ok: false,
          provider,
          status: r.status,
          error: String(r.data?.message || r.data?.name || `http_${r.status}`).slice(0, 200),
        };
      }
      return { ok: true, provider, status: r.status, id: r.data?.id || null };
    }

    // brevo
    const body = {
      sender: from.name ? { name: from.name, email: from.email } : { email: from.email },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
      replyTo: { email: replyTo },
    };
    if (bcc) body.bcc = [{ email: bcc }];
    if (msg.tags) body.tags = Object.values(msg.tags).map(String).slice(0, 10);
    const r = await postJson(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
      body,
      fetchImpl,
    );
    if (!r.ok) {
      return {
        ok: false,
        provider,
        status: r.status,
        error: String(r.data?.message || r.data?.code || `http_${r.status}`).slice(0, 200),
      };
    }
    return { ok: true, provider, status: r.status, id: r.data?.messageId || null };
  } catch (err) {
    const name = err && err.name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, provider, error: `${name}: ${String(err?.message || err).slice(0, 150)}` };
  }
}

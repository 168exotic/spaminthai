// Tests for the tip acknowledgment email:
//   functions/api/mail.js          — provider abstraction (Resend / Brevo over fetch)
//   functions/api/tip-ack-mail.js  — Thai template + send/record on the stored tip
//   functions/api/report.js        — auto-send after a detailed web tip is stored
//   functions/api/admin-tips.js    — POST /api/admin/tips/:id/ack-email (re)send
// Run with: npm test
import {
  extractEmail,
  isEmailAddress,
  mailProvider,
  parseAddress,
  sendMail,
} from '../functions/api/mail.js';
import {
  applyAckResult,
  autoAckEnabled,
  buildTipAckEmail,
  formatThaiDateTime,
  formatThaiPhone,
  sendTipAckById,
  tipReference,
} from '../functions/api/tip-ack-mail.js';
import { handleReportPost } from '../functions/api/report.js';
import { handleAdminTipAckEmail, handleAdminTipsList } from '../functions/api/admin-tips.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  - ${name}`); }
  else { failed++; console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

class MockKV {
  constructor() { this.store = new Map(); }
  async get(k, type) {
    if (!this.store.has(k)) return null;
    const v = this.store.get(k);
    return type === 'arrayBuffer' ? v : v;
  }
  async put(k, v) { this.store.set(k, typeof v === 'string' ? v : v); }
  async delete(k) { this.store.delete(k); }
}

/** fetch stub that records calls and answers with a canned status/body. */
function mockFetch({ status = 200, body = { id: 'msg_123' }, throws = null } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, json: init?.body ? JSON.parse(init.body) : null });
    if (throws) throw throws;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

// ---------------------------------------------------------------- mail.js
check('isEmailAddress accepts normal address', isEmailAddress('darlaapple8@gmail.com'));
check('isEmailAddress accepts subdomain + plus', isEmailAddress('a.b+tag@mail.example.co.th'));
check('isEmailAddress rejects LINE id', !isEmailAddress('@spaminthai'));
check('isEmailAddress rejects no tld', !isEmailAddress('foo@bar'));
check('isEmailAddress rejects spaces', !isEmailAddress('foo bar@x.com'));
check('isEmailAddress rejects angle brackets', !isEmailAddress('<x@y.com>'));
check('extractEmail pulls from mixed text', extractEmail('LINE: boss99 / Boss@Example.com') === 'boss@example.com');
check('extractEmail null for LINE only', extractEmail('line id: boss99') === null);
check('extractEmail trims plain address', extractEmail('  Foo@Bar.com ') === 'foo@bar.com');

check('provider null when no key', mailProvider({}) === null);
check('provider resend by key', mailProvider({ RESEND_API_KEY: 'k' }) === 'resend');
check('provider brevo by key', mailProvider({ BREVO_API_KEY: 'k' }) === 'brevo');
check('provider resend preferred when both', mailProvider({ RESEND_API_KEY: 'a', BREVO_API_KEY: 'b' }) === 'resend');
check('MAIL_PROVIDER=brevo overrides', mailProvider({ RESEND_API_KEY: 'a', BREVO_API_KEY: 'b', MAIL_PROVIDER: 'brevo' }) === 'brevo');
check('MAIL_PROVIDER=brevo without key -> null', mailProvider({ RESEND_API_KEY: 'a', MAIL_PROVIDER: 'brevo' }) === null);

{
  const a = parseAddress('SpamInThai <admin@spaminthai.com>');
  check('parseAddress name + email', a.name === 'SpamInThai' && a.email === 'admin@spaminthai.com');
  const b = parseAddress('admin@spaminthai.com');
  check('parseAddress bare email', b.name === null && b.email === 'admin@spaminthai.com');
  const c = parseAddress('"ทีมงาน SpamInThai" <noreply@spaminthai.com>');
  check('parseAddress quoted thai name', c.name === 'ทีมงาน SpamInThai' && c.email === 'noreply@spaminthai.com');
}

{
  const r = await sendMail({}, { to: 'x@y.com', subject: 's', text: 't' });
  check('sendMail without provider -> mail_not_configured', !r.ok && r.error === 'mail_not_configured');
}
{
  const f = mockFetch();
  const r = await sendMail({ RESEND_API_KEY: 'rk', MAIL_BCC: 'admin@spaminthai.com' }, { to: 'bad', subject: 's', text: 't' }, { fetch: f });
  check('sendMail invalid recipient -> no fetch', !r.ok && r.error === 'invalid_recipient' && f.calls.length === 0);
}
{
  const f = mockFetch({ body: { id: 'resend-1' } });
  const env = { RESEND_API_KEY: 'rk', MAIL_BCC: 'admin@spaminthai.com', MAIL_REPLY_TO: 'reply@spaminthai.com' };
  const r = await sendMail(env, { to: 'user@example.com', subject: 'Subj', text: 'Hello\n\nWorld', tags: { kind: 'tip_ack' } }, { fetch: f });
  check('resend: ok + id', r.ok && r.id === 'resend-1' && r.provider === 'resend');
  const call = f.calls[0];
  check('resend: endpoint', call.url === 'https://api.resend.com/emails');
  check('resend: bearer auth', call.init.headers.Authorization === 'Bearer rk');
  check('resend: default from', call.json.from === 'SpamInThai <admin@spaminthai.com>');
  check('resend: to array', Array.isArray(call.json.to) && call.json.to[0] === 'user@example.com');
  check('resend: reply_to from env', call.json.reply_to === 'reply@spaminthai.com');
  check('resend: bcc from env', Array.isArray(call.json.bcc) && call.json.bcc[0] === 'admin@spaminthai.com');
  check('resend: html generated from text', /<p[^>]*>Hello<\/p>/.test(call.json.html) || /Hello/.test(call.json.html));
  check('resend: tags mapped', call.json.tags[0].name === 'kind' && call.json.tags[0].value === 'tip_ack');
}
{
  const f = mockFetch();
  const env = { RESEND_API_KEY: 'rk', MAIL_BCC: 'Same@Example.com' };
  await sendMail(env, { to: 'same@example.com', subject: 'S', text: 'T' }, { fetch: f });
  check('resend: bcc dropped when it equals recipient', f.calls[0].json.bcc === undefined);
}
{
  const f = mockFetch({ status: 422, body: { name: 'validation_error', message: 'The spaminthai.com domain is not verified' } });
  const r = await sendMail({ RESEND_API_KEY: 'rk' }, { to: 'u@example.com', subject: 'S', text: 'T' }, { fetch: f });
  check('resend: API error surfaced', !r.ok && r.status === 422 && /not verified/.test(r.error));
}
{
  const f = mockFetch({ throws: Object.assign(new Error('fetch failed'), { name: 'TypeError' }) });
  const r = await sendMail({ RESEND_API_KEY: 'rk' }, { to: 'u@example.com', subject: 'S', text: 'T' }, { fetch: f });
  check('resend: network error does not throw', !r.ok && /network_error/.test(r.error));
}
{
  const f = mockFetch({ throws: Object.assign(new Error('aborted'), { name: 'AbortError' }) });
  const r = await sendMail({ RESEND_API_KEY: 'rk' }, { to: 'u@example.com', subject: 'S', text: 'T' }, { fetch: f });
  check('resend: timeout reported', !r.ok && /^timeout/.test(r.error));
}
{
  const f = mockFetch({ status: 201, body: { messageId: '<brevo-1@smtp>' } });
  const env = { BREVO_API_KEY: 'bk', MAIL_FROM: 'ทีมงาน SpamInThai <admin@spaminthai.com>' };
  const r = await sendMail(env, { to: 'user@example.com', subject: 'Subj', text: 'Body' }, { fetch: f });
  check('brevo: ok + messageId', r.ok && r.id === '<brevo-1@smtp>' && r.provider === 'brevo');
  const call = f.calls[0];
  check('brevo: endpoint', call.url === 'https://api.brevo.com/v3/smtp/email');
  check('brevo: api-key header', call.init.headers['api-key'] === 'bk');
  check('brevo: sender object', call.json.sender.name === 'ทีมงาน SpamInThai' && call.json.sender.email === 'admin@spaminthai.com');
  check('brevo: to array of objects', call.json.to[0].email === 'user@example.com');
  check('brevo: textContent + htmlContent', call.json.textContent === 'Body' && /Body/.test(call.json.htmlContent));
  check('brevo: replyTo default', call.json.replyTo.email === 'admin@spaminthai.com');
}

// --------------------------------------------------------- tip-ack-mail.js
check('formatThaiPhone mobile 10 digits', formatThaiPhone('0947469212') === '094-746-9212');
check('formatThaiPhone landline 9 digits', formatThaiPhone('021234567') === '02-123-4567');
check('formatThaiPhone odd input unchanged', formatThaiPhone('12345') === '12345');
check('formatThaiDateTime Bangkok + Buddhist year', formatThaiDateTime('2026-10-17T02:05:00Z') === '17 ต.ค. 2569 เวลา 09:05 น.');
check('formatThaiDateTime crosses midnight', formatThaiDateTime('2026-10-17T18:30:00Z') === '18 ต.ค. 2569 เวลา 01:30 น.');
check('formatThaiDateTime bad input', formatThaiDateTime('nope') === '-');
check('tipReference 8 upper hex', tipReference({ id: 'ab12cd34-5678-90ef-ghij-klmnopqrstuv' }) === 'AB12CD34');

const sampleTip = {
  id: 'ab12cd34-5678-4000-8000-000000000000',
  phone: '0947469212',
  category: 'impersonate',
  detail: 'โทรมาอ้างว่าเป็นธนาคาร',
  contact: 'darlaapple8@gmail.com',
  ts: '2026-10-17T02:05:00Z',
  status: 'pending',
};
{
  const m = buildTipAckEmail(sampleTip);
  check('subject has formatted phone + ref', m.subject === '[SpamInThai] ได้รับรายงานหมายเลข 094-746-9212 แล้ว (อ้างอิง AB12CD34)');
  check('text greets formally', m.text.startsWith('เรียน ท่านผู้แจ้งเรื่อง'));
  check('text names category label', m.text.includes('แอบอ้างหน่วยงานรัฐ'));
  check('text has Thai timestamp', m.text.includes('17 ต.ค. 2569 เวลา 09:05 น.'));
  check('text has reference', m.text.includes('เลขอ้างอิงรายงาน: AB12CD34'));
  check('text states not a bank/government', m.text.includes('ไม่ใช่หน่วยงานราชการหรือสถาบันการเงิน'));
  check('text has no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m.text));
  check('text has no hotline numbers', !/\b1441\b|\b1599\b|\b191\b/.test(m.text));
  check('text does not echo the report detail', !m.text.includes(sampleTip.detail));
  check('text signs off with team + site', m.text.includes('ทีมงาน SpamInThai') && m.text.includes('https://spaminthai.com'));
  check('html is a full document with subject', m.html.startsWith('<!DOCTYPE html>') && m.html.includes('AB12CD34'));
  check('html escapes nothing dangerous', !m.html.includes('<script'));
}
{
  const m = buildTipAckEmail({ ...sampleTip, category: 'sms' });
  check('sms category gets sms advice', m.text.includes('ไม่กดลิงก์ใน SMS'));
  const m2 = buildTipAckEmail({ ...sampleTip, category: 'zzz' });
  check('unknown category falls back', m2.text.includes('พฤติกรรมต้องสงสัย'));
}
{
  const m = buildTipAckEmail({ ...sampleTip, phone: '<b>x</b>', id: null, ts: null });
  check('html escapes phone', !m.html.includes('<b>x</b>'));
  check('missing id/ts tolerated', m.subject.includes('อ้างอิง -') && m.text.includes('เมื่อ -'));
}

check('autoAck off without provider', autoAckEnabled({}) === false);
check('autoAck on with provider', autoAckEnabled({ RESEND_API_KEY: 'k' }) === true);
check('autoAck off when MAIL_ACK_ENABLED=0', autoAckEnabled({ RESEND_API_KEY: 'k', MAIL_ACK_ENABLED: '0' }) === false);
check('autoAck off when MAIL_ACK_ENABLED=false', autoAckEnabled({ RESEND_API_KEY: 'k', MAIL_ACK_ENABLED: 'false' }) === false);

{
  const tip = {};
  applyAckResult(tip, { ok: false, error: 'boom', to: 'a@b.com', provider: 'resend' });
  check('applyAckResult failure recorded', tip.ackEmail.attempts === 1 && tip.ackEmail.sentAt === null && tip.ackEmail.lastError === 'boom');
  applyAckResult(tip, { ok: true, id: 'm1', to: 'a@b.com', provider: 'resend' });
  check('applyAckResult success clears error', tip.ackEmail.attempts === 2 && tip.ackEmail.sentAt && tip.ackEmail.lastError === null && tip.ackEmail.messageId === 'm1');
}

async function seedTip(kv, tip) {
  await kv.put(`tip:${tip.id}`, JSON.stringify(tip));
  await kv.put('tips:index', JSON.stringify([{ id: tip.id, phone: tip.phone, category: tip.category, status: tip.status, ts: tip.ts, hasImage: false }]));
}

{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const f = mockFetch({ body: { id: 'resend-ack' } });
  const env = { RESEND_API_KEY: 'rk', SPAM_KV: kv };
  const r = await sendTipAckById(env, sampleTip.id, { fetch: f });
  check('sendTipAckById ok', r.ok === true && r.ackEmail.sentAt && r.ackEmail.to === 'darlaapple8@gmail.com');
  const stored = JSON.parse(await kv.get(`tip:${sampleTip.id}`));
  check('ack persisted on tip', stored.ackEmail.messageId === 'resend-ack' && stored.ackEmail.provider === 'resend');
  const idx = JSON.parse(await kv.get('tips:index'));
  check('index flagged ackSent', idx[0].ackSent === true);
  check('mail sent to contact email', f.calls[0].json.to[0] === 'darlaapple8@gmail.com');

  const again = await sendTipAckById(env, sampleTip.id, { fetch: f });
  check('second auto send skipped (already_sent)', again.ok === false && again.skipped === true && f.calls.length === 1);

  const forced = await sendTipAckById(env, sampleTip.id, { fetch: f, force: true, to: 'other@example.com' });
  check('forced resend to override address', forced.ok && f.calls.length === 2 && f.calls[1].json.to[0] === 'other@example.com');
  check('attempts counted', forced.ackEmail.attempts === 2 && forced.ackEmail.to === 'other@example.com');
}
{
  const kv = new MockKV();
  await seedTip(kv, { ...sampleTip, contact: 'LINE: boss99' });
  const f = mockFetch();
  const r = await sendTipAckById({ RESEND_API_KEY: 'rk', SPAM_KV: kv }, sampleTip.id, { fetch: f });
  check('no email in contact -> no_email, no fetch', !r.ok && r.error === 'no_email' && f.calls.length === 0);
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const f = mockFetch({ status: 500, body: { message: 'upstream down' } });
  const r = await sendTipAckById({ RESEND_API_KEY: 'rk', SPAM_KV: kv }, sampleTip.id, { fetch: f });
  check('provider failure recorded, not thrown', !r.ok && /upstream down/.test(r.error));
  const stored = JSON.parse(await kv.get(`tip:${sampleTip.id}`));
  check('failure persisted with lastError', stored.ackEmail.sentAt === null && /upstream down/.test(stored.ackEmail.lastError));
  const idx = JSON.parse(await kv.get('tips:index'));
  check('index not flagged on failure', !idx[0].ackSent);
}
{
  const r = await sendTipAckById({ RESEND_API_KEY: 'rk', SPAM_KV: new MockKV() }, 'missing');
  check('unknown tip -> not_found', !r.ok && r.error === 'not_found');
}

// ------------------------------------------------- report.js auto-send
function multipartRequest(fields, { ip = '1.2.3.4' } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'proof.jpg', { type: 'image/jpeg' });
  form.append('evidenceImage', file);
  return new Request('https://spaminthai.com/api/report', {
    method: 'POST',
    body: form,
    headers: { 'CF-Connecting-IP': ip },
  });
}
const tipFields = {
  phone: '094-746-9212',
  category: 'impersonate',
  detail: 'โทรมาแจ้งว่าโทรจากธนาคาร แล้วถามข้อมูลบัตรประชาชน',
  evidence: '',
  contact: 'darlaapple8@gmail.com',
  consent: 'true',
  ts: '2026-10-17T02:05:00Z',
};

{
  // waitUntil present → response says 'queued' and the mail goes out in the background
  const kv = new MockKV();
  const f = mockFetch({ body: { id: 'resend-web' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const pending = [];
    const ctx = { waitUntil: (p) => pending.push(p) };
    const res = await handleReportPost({ request: multipartRequest(tipFields), env: { RESEND_API_KEY: 'rk', SPAM_KV: kv }, ctx });
    const data = await res.json();
    check('web tip -> 200 + tipId', res.status === 200 && Boolean(data.tipId), JSON.stringify(data));
    check('response ackEmail=queued', data.ackEmail === 'queued');
    check('one background job scheduled', pending.length === 1);
    await Promise.all(pending);
    check('background mail sent once', f.calls.length === 1 && f.calls[0].json.to[0] === 'darlaapple8@gmail.com');
    check('mail subject carries phone', /094-746-9212/.test(f.calls[0].json.subject));
    const stored = JSON.parse(await kv.get(`tip:${data.tipId}`));
    check('tip stored with ackEmail.sentAt', Boolean(stored.ackEmail?.sentAt));
    const idx = JSON.parse(await kv.get('tips:index'));
    check('index entry ackSent', idx[0].id === data.tipId && idx[0].ackSent === true);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  // no waitUntil (tests / older runtimes) → awaited inline, 'sent'
  const kv = new MockKV();
  const f = mockFetch({ body: { id: 'x' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleReportPost({ request: multipartRequest(tipFields, { ip: '5.6.7.8' }), env: { RESEND_API_KEY: 'rk', SPAM_KV: kv } });
    const data = await res.json();
    check('no ctx -> ackEmail=sent', data.ackEmail === 'sent' && f.calls.length === 1);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  // mail not configured → skipped, no fetch, report still stored
  const kv = new MockKV();
  const f = mockFetch();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleReportPost({ request: multipartRequest(tipFields, { ip: '9.9.9.9' }), env: { SPAM_KV: kv }, ctx: { waitUntil() {} } });
    const data = await res.json();
    check('no provider -> ackEmail=skipped, tip stored', data.ackEmail === 'skipped' && f.calls.length === 0 && Boolean(await kv.get(`tip:${data.tipId}`)));
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  // LINE contact → skipped
  const kv = new MockKV();
  const f = mockFetch();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleReportPost({ request: multipartRequest({ ...tipFields, contact: 'LINE @boss99' }, { ip: '8.8.8.8' }), env: { RESEND_API_KEY: 'rk', SPAM_KV: kv }, ctx: { waitUntil() {} } });
    const data = await res.json();
    check('LINE contact -> skipped, no fetch', data.ackEmail === 'skipped' && f.calls.length === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  // MAIL_ACK_ENABLED=0 → skipped even with provider
  const kv = new MockKV();
  const f = mockFetch();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleReportPost({ request: multipartRequest(tipFields, { ip: '7.7.7.7' }), env: { RESEND_API_KEY: 'rk', MAIL_ACK_ENABLED: '0', SPAM_KV: kv }, ctx: { waitUntil() {} } });
    const data = await res.json();
    check('MAIL_ACK_ENABLED=0 -> skipped', data.ackEmail === 'skipped' && f.calls.length === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  // quick (non-detailed) report → no tip, no mail
  const kv = new MockKV();
  const f = mockFetch();
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const req = new Request('https://spaminthai.com/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '6.6.6.6' },
      body: JSON.stringify({ number: '0947469212', category: 'scam' }),
    });
    const res = await handleReportPost({ request: req, env: { RESEND_API_KEY: 'rk', SPAM_KV: kv }, ctx: { waitUntil() {} } });
    const data = await res.json();
    check('quick report -> skipped, no fetch', res.status === 200 && data.tipId === null && data.ackEmail === 'skipped' && f.calls.length === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ------------------------------------------------- admin resend endpoint
const ADMIN = 'secret-admin';
function adminReq(body, { key = ADMIN, method = 'POST' } = {}) {
  return new Request('https://spaminthai.com/api/admin/tips/x/ack-email', {
    method,
    headers: { 'X-Admin-Key': key, 'Content-Type': 'application/json', 'CF-Connecting-IP': '2.2.2.2' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const res = await handleAdminTipAckEmail({ request: adminReq({}, { key: 'wrong' }), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
  check('admin ack: wrong key -> 401', res.status === 401);
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const res = await handleAdminTipAckEmail({ request: adminReq({}), env: { TIP_ADMIN_PASSWORD: ADMIN, SPAM_KV: kv }, tipId: sampleTip.id });
  const data = await res.json();
  check('admin ack: mail not configured -> 503', res.status === 503 && data.error === 'mail_not_configured' && data.mail.configured === false);
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const res = await handleAdminTipAckEmail({ request: adminReq({ to: 'not-an-email' }), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
  check('admin ack: invalid override -> 400', res.status === 400);
}
{
  const kv = new MockKV();
  await seedTip(kv, { ...sampleTip, contact: 'line boss' });
  const res = await handleAdminTipAckEmail({ request: adminReq({}), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
  const data = await res.json();
  check('admin ack: LINE contact without override -> 400 no_email', res.status === 400 && data.error === 'no_email');
}
{
  const kv = new MockKV();
  const res = await handleAdminTipAckEmail({ request: adminReq({}), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: 'nope' });
  check('admin ack: unknown tip -> 404', res.status === 404);
}
{
  const kv = new MockKV();
  await seedTip(kv, { ...sampleTip, ackEmail: { to: 'darlaapple8@gmail.com', sentAt: '2026-10-17T03:00:00Z', attempts: 1, provider: 'resend' } });
  const f = mockFetch({ body: { id: 'resend-again' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleAdminTipAckEmail({ request: adminReq({}), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
    const data = await res.json();
    check('admin ack: resend forces even if already sent', res.status === 200 && data.ok && data.ackEmail.attempts === 2 && f.calls.length === 1);
    const idx = JSON.parse(await kv.get('tips:index'));
    check('admin ack: index flagged', idx[0].ackSent === true);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  const kv = new MockKV();
  await seedTip(kv, { ...sampleTip, contact: 'line boss' });
  const f = mockFetch({ body: { id: 'resend-override' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleAdminTipAckEmail({ request: adminReq({ to: 'Typed@Example.com' }), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
    const data = await res.json();
    check('admin ack: override address used', res.status === 200 && data.ackEmail.to === 'typed@example.com' && f.calls[0].json.to[0] === 'typed@example.com');
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const f = mockFetch({ status: 403, body: { message: 'domain not verified' } });
  const realFetch = globalThis.fetch;
  globalThis.fetch = f;
  try {
    const res = await handleAdminTipAckEmail({ request: adminReq({}), env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 'rk', SPAM_KV: kv }, tipId: sampleTip.id });
    const data = await res.json();
    check('admin ack: provider error -> 502 with reason', res.status === 502 && /domain not verified/.test(data.error) && data.ackEmail.lastError);
  } finally {
    globalThis.fetch = realFetch;
  }
}
{
  const kv = new MockKV();
  await seedTip(kv, sampleTip);
  const req = new Request('https://spaminthai.com/api/admin/tips', { headers: { 'X-Admin-Key': ADMIN, 'CF-Connecting-IP': '3.3.3.3' } });
  const res = await handleAdminTipsList({ request: req, env: { TIP_ADMIN_PASSWORD: ADMIN, RESEND_API_KEY: 're_SECRET_KEY_VALUE', MAIL_FROM: 'SpamInThai <admin@spaminthai.com>', SPAM_KV: kv } });
  const data = await res.json();
  check('admin list exposes mail status (no keys)', data.mail.configured === true && data.mail.provider === 'resend' && data.mail.autoAck === true && !JSON.stringify(data).includes('re_SECRET_KEY_VALUE'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

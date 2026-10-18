// Acknowledgment email for scam tips submitted through /report (stored as tip:<id>).
//
// Flow: /api/report stores the tip → sendTipAckById() mails "ได้รับเรื่องแล้ว" to the
// reporter when their contact field is an email address → the outcome is written
// back onto the tip as `ackEmail` so /admin/tips can show it and re-send.
//
// Wording rules (same as every SpamInThai outbound text): formal Thai, no emoji,
// no hotline numbers or agency names, no promises about outcomes, and a clear
// statement that SpamInThai is a community reporting service — not a bank or a
// government body.

import { FORM_CAT_LABELS, patchTipIndex } from './tip-utils.js';
import { extractEmail, mailConfigured, sendMail, DEFAULT_REPLY_TO } from './mail.js';

export const ACK_FROM_NAME = 'ทีมงาน SpamInThai';
export const SITE_URL = 'https://spaminthai.com';
export const APP_NAME = 'ปกป้องจากสายมิจฉาชีพ';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** 0947469212 → 094-746-9212, 021234567 → 02-123-4567 (unknown shapes returned as-is). */
export function formatThaiPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return d || '-';
}

/** ISO timestamp → "17 ต.ค. 2569 เวลา 09:05 น." in Asia/Bangkok (UTC+7, no DST). */
export function formatThaiDateTime(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '-';
  const d = new Date(t + 7 * 60 * 60 * 1000);
  const day = d.getUTCDate();
  const mon = TH_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear() + 543;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${mon} ${year} เวลา ${hh}:${mm} น.`;
}

/** Short reference the reporter can quote back: first 8 chars of the tip id. */
export function tipReference(tip) {
  return String(tip?.id || '').replace(/-/g, '').slice(0, 8).toUpperCase() || '-';
}

const CATEGORY_ADVICE = {
  scam: 'ไม่แจ้งเลขบัตรประชาชน รหัส OTP หรือข้อมูลบัญชีทางโทรศัพท์แก่ผู้ที่โทรเข้ามา ไม่ว่าจะอ้างว่าเป็นหน่วยงานใด และไม่โอนเงินตามคำสั่งของผู้โทร',
  impersonate: 'หน่วยงานราชการและธนาคารไม่ขอรหัส OTP ไม่ให้โอนเงินเพื่อตรวจสอบ และไม่ให้ติดตั้งแอปผ่านลิงก์ทางโทรศัพท์ หากสงสัยให้วางสายแล้วติดต่อหน่วยงานนั้นผ่านช่องทางทางการด้วยตนเอง',
  loanshark: 'ไม่โอนค่าธรรมเนียมหรือค่ามัดจำใด ๆ ก่อนได้รับเงินกู้ และเก็บหลักฐานการสนทนาและการโอนเงินไว้ทั้งหมด หากถูกข่มขู่ให้แจ้งความกับเจ้าหน้าที่ตำรวจ',
  sms: 'ไม่กดลิงก์ใน SMS ที่ไม่ได้ร้องขอ ไม่กรอกข้อมูลส่วนตัวในหน้าเว็บที่เปิดจากลิงก์ และไม่ติดตั้งแอปจากลิงก์ที่ส่งมา',
  gambling: 'ไม่สมัครสมาชิกหรือโอนเงินตามคำชักชวน และบล็อกหมายเลขหรือบัญชีที่ติดต่อมา',
  other: 'ไม่แจ้งข้อมูลส่วนตัว รหัส OTP หรือข้อมูลบัญชีทางโทรศัพท์แก่ผู้ที่โทรเข้ามา และไม่โอนเงินตามคำสั่งของผู้โทร',
};

/**
 * Build subject/text/html for the acknowledgment.
 * @param {object} tip  stored tip (phone, category, ts, id)
 */
export function buildTipAckEmail(tip) {
  const phone = formatThaiPhone(tip?.phone);
  const label = FORM_CAT_LABELS[tip?.category] || 'พฤติกรรมต้องสงสัย';
  const when = formatThaiDateTime(tip?.ts);
  const ref = tipReference(tip);
  const advice = CATEGORY_ADVICE[tip?.category] || CATEGORY_ADVICE.other;

  const subject = `[SpamInThai] ได้รับรายงานหมายเลข ${phone} แล้ว (อ้างอิง ${ref})`;

  const text = [
    'เรียน ท่านผู้แจ้งเรื่อง',
    '',
    `ทีมงาน SpamInThai ได้รับรายงานของท่านเกี่ยวกับหมายเลข ${phone} (ประเภท: ${label}) ซึ่งแจ้งเข้ามาเมื่อ ${when} เรียบร้อยแล้ว ขอขอบคุณที่ท่านสละเวลาแจ้งเข้ามา ข้อมูลของท่านจะช่วยปกป้องผู้ใช้ท่านอื่นจากหมายเลขนี้ได้`,
    '',
    `เลขอ้างอิงรายงาน: ${ref}`,
    '',
    'การดำเนินการของทีมงาน',
    '1. ระบบได้บันทึกหมายเลขดังกล่าวพร้อมรายละเอียดที่ท่านแจ้ง เข้าสู่ฐานข้อมูลเบอร์ต้องสงสัยของ SpamInThai แล้ว',
    `2. ทีมงานจะตรวจสอบรายละเอียดและหลักฐานที่แนบมา และข้อมูลนี้จะใช้แจ้งเตือนผู้ที่ค้นหาหมายเลขดังกล่าวบนเว็บไซต์ spaminthai.com และผู้ใช้แอป "${APP_NAME}"`,
    '',
    'ข้อควรทราบ',
    'SpamInThai เป็นระบบรายงานและแจ้งเตือนเบอร์โทรจากข้อมูลของผู้ใช้ ไม่ใช่หน่วยงานราชการหรือสถาบันการเงิน จึงไม่สามารถตรวจสอบธุรกรรม อายัดบัญชี หรือดำเนินคดีกับผู้โทรได้ หากท่านได้รับความเสียหาย หรือกังวลว่าข้อมูลส่วนตัวจะถูกนำไปใช้ กรุณาติดต่อธนาคารของท่านผ่านช่องทางทางการโดยตรง และแจ้งความกับเจ้าหน้าที่ตำรวจเพื่อเป็นหลักฐาน',
    '',
    'คำแนะนำ',
    `- ${advice}`,
    '- ไม่โทรกลับหมายเลขที่โทรมา ไม่กดลิงก์ และไม่ติดตั้งแอปตามที่ผู้โทรแนะนำ',
    '',
    'หากท่านมีข้อมูลเพิ่มเติม เช่น หมายเลขอื่นที่เกี่ยวข้องหรือข้อความที่ได้รับ สามารถตอบกลับอีเมลฉบับนี้ได้โดยตรง',
    '',
    'ขอแสดงความนับถือ',
    ACK_FROM_NAME,
    DEFAULT_REPLY_TO,
    SITE_URL,
    '',
    '(อีเมลฉบับนี้ส่งโดยอัตโนมัติเมื่อระบบได้รับรายงานของท่าน)',
  ].join('\n');

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p = (s) => `<p style="margin:0 0 14px">${esc(s)}</p>`;
  const h = (s) => `<p style="margin:18px 0 6px;font-weight:700">${esc(s)}</p>`;
  const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:'IBM Plex Sans Thai',Sarabun,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1f2937">
<tr><td style="background:#f97316;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700">SpamInThai</td></tr>
<tr><td style="padding:24px">
${p('เรียน ท่านผู้แจ้งเรื่อง')}
${p(`ทีมงาน SpamInThai ได้รับรายงานของท่านเกี่ยวกับหมายเลข ${phone} (ประเภท: ${label}) ซึ่งแจ้งเข้ามาเมื่อ ${when} เรียบร้อยแล้ว ขอขอบคุณที่ท่านสละเวลาแจ้งเข้ามา ข้อมูลของท่านจะช่วยปกป้องผู้ใช้ท่านอื่นจากหมายเลขนี้ได้`)}
<p style="margin:0 0 14px;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px"><b>เลขอ้างอิงรายงาน:</b> ${esc(ref)}</p>
${h('การดำเนินการของทีมงาน')}
<ol style="margin:0 0 14px;padding-left:22px">
<li>ระบบได้บันทึกหมายเลขดังกล่าวพร้อมรายละเอียดที่ท่านแจ้ง เข้าสู่ฐานข้อมูลเบอร์ต้องสงสัยของ SpamInThai แล้ว</li>
<li>ทีมงานจะตรวจสอบรายละเอียดและหลักฐานที่แนบมา และข้อมูลนี้จะใช้แจ้งเตือนผู้ที่ค้นหาหมายเลขดังกล่าวบนเว็บไซต์ spaminthai.com และผู้ใช้แอป &quot;${esc(APP_NAME)}&quot;</li>
</ol>
${h('ข้อควรทราบ')}
${p('SpamInThai เป็นระบบรายงานและแจ้งเตือนเบอร์โทรจากข้อมูลของผู้ใช้ ไม่ใช่หน่วยงานราชการหรือสถาบันการเงิน จึงไม่สามารถตรวจสอบธุรกรรม อายัดบัญชี หรือดำเนินคดีกับผู้โทรได้ หากท่านได้รับความเสียหาย หรือกังวลว่าข้อมูลส่วนตัวจะถูกนำไปใช้ กรุณาติดต่อธนาคารของท่านผ่านช่องทางทางการโดยตรง และแจ้งความกับเจ้าหน้าที่ตำรวจเพื่อเป็นหลักฐาน')}
${h('คำแนะนำ')}
<ul style="margin:0 0 14px;padding-left:22px">
<li>${esc(advice)}</li>
<li>ไม่โทรกลับหมายเลขที่โทรมา ไม่กดลิงก์ และไม่ติดตั้งแอปตามที่ผู้โทรแนะนำ</li>
</ul>
${p('หากท่านมีข้อมูลเพิ่มเติม เช่น หมายเลขอื่นที่เกี่ยวข้องหรือข้อความที่ได้รับ สามารถตอบกลับอีเมลฉบับนี้ได้โดยตรง')}
<p style="margin:18px 0 0">ขอแสดงความนับถือ<br>${esc(ACK_FROM_NAME)}<br><a href="mailto:${esc(DEFAULT_REPLY_TO)}" style="color:#ea580c">${esc(DEFAULT_REPLY_TO)}</a><br><a href="${esc(SITE_URL)}" style="color:#ea580c">${esc(SITE_URL)}</a></p>
</td></tr>
<tr><td style="padding:12px 24px;background:#f9fafb;color:#6b7280;font-size:12px">อีเมลฉบับนี้ส่งโดยอัตโนมัติเมื่อระบบได้รับรายงานของท่าน</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}

/** Recipient for a tip: explicit override, else the email inside the contact field. */
export function tipAckRecipient(tip, override) {
  if (override) return extractEmail(override);
  return extractEmail(tip?.contact);
}

/** Auto-ack is on whenever a mail provider is configured, unless MAIL_ACK_ENABLED=0. */
export function autoAckEnabled(env) {
  if (!mailConfigured(env)) return false;
  const v = String(env?.MAIL_ACK_ENABLED ?? '1').trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

/**
 * Send the acknowledgment for an already-stored tip.
 * Does NOT persist anything — see sendTipAckById() for the KV write-back.
 * @returns {Promise<{ok:boolean, skipped?:boolean, error?:string, to?:string, provider?:string|null, id?:string|null, status?:number}>}
 */
export async function sendTipAck(env, tip, { to, force = false, fetch: fetchImpl } = {}) {
  const recipient = tipAckRecipient(tip, to);
  if (!recipient) return { ok: false, error: 'no_email', to: null };
  if (!force && tip?.ackEmail?.sentAt) {
    return { ok: false, skipped: true, error: 'already_sent', to: tip.ackEmail.to || recipient };
  }
  const mail = buildTipAckEmail(tip);
  const result = await sendMail(
    env,
    { to: recipient, ...mail, tags: { kind: 'tip_ack', tip: tipReference(tip) } },
    fetchImpl ? { fetch: fetchImpl } : {},
  );
  return { ...result, to: recipient };
}

/** Merge a send result into tip.ackEmail (kept small: no message bodies). */
export function applyAckResult(tip, result) {
  const now = new Date().toISOString();
  const prev = tip.ackEmail || {};
  const next = {
    to: result.to || prev.to || null,
    provider: result.provider || prev.provider || null,
    attempts: (prev.attempts || 0) + 1,
    sentAt: result.ok ? now : prev.sentAt || null,
    messageId: result.ok ? result.id || null : prev.messageId || null,
    lastTriedAt: now,
    lastError: result.ok ? null : String(result.error || 'unknown').slice(0, 200),
  };
  tip.ackEmail = next;
  return next;
}

/**
 * Load tip:<id>, send the acknowledgment, write the outcome back to KV (+ index flag).
 * Safe to call from ctx.waitUntil(): never throws.
 * @param {object} env
 * @param {string} tipId
 * @param {{to?:string, force?:boolean, fetch?:typeof fetch}} [opts]
 * @returns {Promise<{ok:boolean, error?:string, skipped?:boolean, ackEmail?:object, tip?:object}>}
 */
export async function sendTipAckById(env, tipId, opts = {}) {
  try {
    const key = `tip:${tipId}`;
    const raw = await env.SPAM_KV.get(key);
    if (!raw) return { ok: false, error: 'not_found' };
    const tip = JSON.parse(raw);

    const result = await sendTipAck(env, tip, opts);
    if (result.skipped) return { ok: false, skipped: true, error: result.error, ackEmail: tip.ackEmail, tip };
    if (result.error === 'no_email') return { ok: false, error: 'no_email', ackEmail: tip.ackEmail || null, tip };

    const ackEmail = applyAckResult(tip, result);
    await env.SPAM_KV.put(key, JSON.stringify(tip), { expirationTtl: 60 * 60 * 24 * 365 });
    if (result.ok) {
      try {
        await patchTipIndex(env, tipId, { ackSent: true });
      } catch {
        /* index flag is cosmetic */
      }
    }
    return { ok: result.ok, error: result.ok ? undefined : result.error, ackEmail, tip };
  } catch (err) {
    return { ok: false, error: `exception: ${String(err?.message || err).slice(0, 150)}` };
  }
}

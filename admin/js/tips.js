// Extracted from /admin/tips.html (inline <script> removed for CSP without 'unsafe-inline').
const KEY_STORAGE = 'spaminthai_admin_key';
let adminKey = localStorage.getItem(KEY_STORAGE) || '';
let labels = {};
let currentTipId = null;
let mailInfo = null; // { configured, provider, autoAck, from } from /api/admin/tips

const $ = (id) => document.getElementById(id);

function headers() {
  return { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' };
}

function statusBadge(s) {
  const map = { pending:'รอตรวจ', reviewed:'ตรวจแล้ว', actioned:'ดำเนินการ', dismissed:'ปิดเคส' };
  return `<span class="badge ${s}">${map[s] || s}</span>`;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('th-TH'); } catch { return ts || '-'; }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const EMAIL_RE = /[^\s@<>"'(),;:[\]\\]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}/;
function emailIn(text) {
  const m = String(text || '').match(EMAIL_RE);
  return m ? m[0] : '';
}

function tipRef(id) {
  return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

function renderMailNotice() {
  const el = $('mailNotice');
  if (!mailInfo) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (!mailInfo.configured) {
    el.className = 'notice warn';
    el.textContent = 'ยังไม่ได้ตั้งค่าระบบส่งอีเมล (RESEND_API_KEY หรือ BREVO_API_KEY ใน Cloudflare Pages) — ผู้แจ้งจะยังไม่ได้รับอีเมลยืนยันรับเรื่อง ดู docs/TIP-ACK-EMAIL.md';
  } else if (!mailInfo.autoAck) {
    el.className = 'notice warn';
    el.textContent = `ส่งอีเมลผ่าน ${mailInfo.provider} ได้ แต่ปิดการส่งอัตโนมัติไว้ (MAIL_ACK_ENABLED=0) — กดส่งเองได้จากหน้ารายละเอียด`;
  } else {
    el.className = 'notice ok';
    el.textContent = `ส่งอีเมลยืนยันรับเรื่องอัตโนมัติผ่าน ${mailInfo.provider} จาก ${mailInfo.from}`;
  }
}

function ackCell(t) {
  if (t.ackSent) return '<span class="ok-text">ส่งแล้ว</span>';
  return '<span class="meta">—</span>';
}

function renderAckBox(tip) {
  const status = $('ackStatus');
  const input = $('ackTo');
  const btn = $('ackSendBtn');
  $('ackErr').classList.add('hidden');
  const ack = tip.ackEmail || null;
  const contactEmail = emailIn(tip.contact);
  input.value = (ack && ack.to) || contactEmail || '';

  if (ack && ack.sentAt) {
    status.innerHTML = `<span class="ok-text">ส่งแล้ว</span> ${esc(fmtTime(ack.sentAt))} ถึง <b>${esc(ack.to)}</b>`
      + (ack.provider ? ` ผ่าน ${esc(ack.provider)}` : '')
      + (ack.attempts > 1 ? ` (ส่ง ${ack.attempts} ครั้ง)` : '');
    btn.textContent = 'ส่งซ้ำ';
  } else if (ack && ack.lastError) {
    status.innerHTML = `<span class="warn-text">ส่งไม่สำเร็จ</span> ${esc(fmtTime(ack.lastTriedAt))} ถึง ${esc(ack.to || '-')} — ${esc(ack.lastError)}`;
    btn.textContent = 'ลองส่งอีกครั้ง';
  } else if (contactEmail) {
    status.textContent = 'ยังไม่ได้ส่ง';
    btn.textContent = 'ส่งอีเมลยืนยันรับเรื่อง';
  } else {
    status.textContent = 'ช่องทางติดต่อกลับไม่ใช่อีเมล (เช่น LINE ID) — พิมพ์อีเมลด้านล่างถ้าต้องการส่ง';
    btn.textContent = 'ส่งอีเมลยืนยันรับเรื่อง';
  }
  btn.disabled = Boolean(mailInfo && !mailInfo.configured);
}

async function sendAck() {
  if (!currentTipId) return;
  const to = $('ackTo').value.trim();
  const btn = $('ackSendBtn');
  const err = $('ackErr');
  err.classList.add('hidden');
  if (!to || !EMAIL_RE.test(to)) {
    err.textContent = 'กรุณากรอกอีเมลผู้รับให้ถูกต้อง';
    err.classList.remove('hidden');
    return;
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง...';
  try {
    const res = await api(`/api/admin/tips/${currentTipId}/ack-email`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const map = {
        mail_not_configured: 'ยังไม่ได้ตั้งค่า RESEND_API_KEY / BREVO_API_KEY ใน Cloudflare Pages',
        invalid_email: 'อีเมลผู้รับไม่ถูกต้อง',
        no_email: 'ไม่มีอีเมลผู้รับ',
        not_found: 'ไม่พบรายงานนี้',
      };
      throw new Error(map[data.error] || `ส่งไม่สำเร็จ: ${data.error || res.status}`);
    }
    await loadTips();
    await openTip(currentTipId);
  } catch (e) {
    err.textContent = e.message || 'ส่งไม่สำเร็จ';
    err.classList.remove('hidden');
    btn.textContent = original;
  } finally {
    btn.disabled = false;
  }
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  if (res.status === 401) throw new Error('unauthorized');
  return res;
}

async function loadTips() {
  const status = $('statusFilter').value;
  const url = status ? `/api/admin/tips?status=${encodeURIComponent(status)}` : '/api/admin/tips';
  const res = await api(url);
  const data = await res.json();
  labels = data.labels || {};
  mailInfo = data.mail || null;
  renderMailNotice();
  const tips = data.tips || [];
  const body = $('tipsBody');
  body.innerHTML = '';
  $('emptyState').classList.toggle('hidden', tips.length > 0);
  tips.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtTime(t.ts)}</td>
      <td><b>${esc(t.phone || '-')}</b></td>
      <td>${esc(labels[t.category] || t.category || '-')}</td>
      <td>${statusBadge(t.status || 'pending')}</td>
      <td>${t.hasImage ? '📷 มีรูป' : '—'}</td>
      <td>${ackCell(t)}</td>
      <td><button class="btn-ghost btn-sm" data-id="${t.id}">ดู</button></td>`;
    tr.querySelector('button').addEventListener('click', () => openTip(t.id));
    body.appendChild(tr);
  });
}

async function openTip(id) {
  currentTipId = id;
  const res = await api(`/api/admin/tips/${id}`);
  const tip = await res.json();
  $('newStatus').value = tip.status || 'pending';
  $('adminNote').value = tip.adminNote || '';

  let evidenceHtml = '';
  if (tip.imageKey) {
    const blob = await (await api(`/api/admin/evidence/${id}`)).blob();
    const url = URL.createObjectURL(blob);
    evidenceHtml = `<div><b>ภาพหลักฐาน</b><br><img class="evidence-img" src="${url}" alt="หลักฐาน"></div>`;
  }

  const safeLink = /^https?:\/\//i.test(tip.evidence || '') ? tip.evidence : '';
  const linkHtml = safeLink
    ? `<div><b>ลิงก์หลักฐาน</b><br><a href="${esc(safeLink)}" target="_blank" rel="noopener">${esc(safeLink)}</a></div>`
    : '';

  $('detailContent').innerHTML = `
    <div class="meta"><b>เลขอ้างอิง:</b> ${tipRef(tip.id)} <span style="opacity:.6">(ผู้แจ้งเห็นเลขนี้ในอีเมลยืนยัน)</span></div>
    <div class="meta"><b>เบอร์:</b> ${esc(tip.phone)}</div>
    <div class="meta"><b>ประเภท:</b> ${esc(labels[tip.category] || tip.category)}</div>
    <div class="meta"><b>เวลาแจ้ง:</b> ${esc(fmtTime(tip.ts))}</div>
    <div class="meta"><b>สถานะ:</b> ${statusBadge(tip.status || 'pending')}</div>
    <div><b>รายละเอียด</b><p style="margin-top:6px;white-space:pre-wrap">${esc(tip.detail || '-')}</p></div>
    ${linkHtml}
    ${evidenceHtml}
    <div class="meta"><b>ติดต่อกลับ:</b> ${esc(tip.contact || '—')}</div>
    ${tip.adminNote ? `<div class="meta"><b>บันทึกเดิม:</b> ${esc(tip.adminNote)}</div>` : ''}`;

  renderAckBox(tip);
  $('detailCard').classList.remove('hidden');
  $('detailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveStatus() {
  if (!currentTipId) return;
  await api(`/api/admin/tips/${currentTipId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: $('newStatus').value, note: $('adminNote').value.trim() }),
  });
  await loadTips();
  await openTip(currentTipId);
}

function showApp() {
  $('loginCard').classList.add('hidden');
  $('app').classList.remove('hidden');
}

function showLogin() {
  $('loginCard').classList.remove('hidden');
  $('app').classList.add('hidden');
}

async function tryLogin() {
  adminKey = $('adminKey').value;
  try {
    const res = await api('/api/admin/tips?status=pending');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'admin_not_configured') {
        $('configErr').classList.remove('hidden');
        $('loginErr').classList.add('hidden');
      } else {
        $('loginErr').classList.remove('hidden');
        $('configErr').classList.add('hidden');
      }
      throw new Error('bad');
    }
    localStorage.setItem(KEY_STORAGE, adminKey);
    $('loginErr').classList.add('hidden');
    $('configErr').classList.add('hidden');
    showApp();
    await loadTips();
  } catch {
    if (!$('configErr').classList.contains('hidden')) return;
    $('loginErr').classList.remove('hidden');
    showLogin();
  }
}

$('loginBtn').addEventListener('click', tryLogin);
$('adminKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
$('refreshBtn').addEventListener('click', loadTips);
$('statusFilter').addEventListener('change', loadTips);
$('saveStatusBtn').addEventListener('click', saveStatus);
$('ackSendBtn').addEventListener('click', sendAck);
$('closeDetailBtn').addEventListener('click', () => $('detailCard').classList.add('hidden'));
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(KEY_STORAGE);
  adminKey = '';
  showLogin();
});

if (adminKey) {
  tryLogin();
}

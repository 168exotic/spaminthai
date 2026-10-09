// Extracted from /admin/tips.html (inline <script> removed for CSP without 'unsafe-inline').
const KEY_STORAGE = 'spaminthai_admin_key';
let adminKey = localStorage.getItem(KEY_STORAGE) || '';
let labels = {};
let currentTipId = null;

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
  const tips = data.tips || [];
  const body = $('tipsBody');
  body.innerHTML = '';
  $('emptyState').classList.toggle('hidden', tips.length > 0);
  tips.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtTime(t.ts)}</td>
      <td><b>${t.phone || '-'}</b></td>
      <td>${labels[t.category] || t.category || '-'}</td>
      <td>${statusBadge(t.status || 'pending')}</td>
      <td>${t.hasImage ? '📷 มีรูป' : '—'}</td>
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

  const linkHtml = tip.evidence
    ? `<div><b>ลิงก์หลักฐาน</b><br><a href="${tip.evidence}" target="_blank" rel="noopener">${tip.evidence}</a></div>`
    : '';

  $('detailContent').innerHTML = `
    <div class="meta"><b>เบอร์:</b> ${tip.phone}</div>
    <div class="meta"><b>ประเภท:</b> ${labels[tip.category] || tip.category}</div>
    <div class="meta"><b>เวลาแจ้ง:</b> ${fmtTime(tip.ts)}</div>
    <div class="meta"><b>สถานะ:</b> ${statusBadge(tip.status || 'pending')}</div>
    <div><b>รายละเอียด</b><p style="margin-top:6px;white-space:pre-wrap">${tip.detail || '-'}</p></div>
    ${linkHtml}
    ${evidenceHtml}
    <div class="meta"><b>ติดต่อกลับ:</b> ${tip.contact || '—'}</div>
    ${tip.adminNote ? `<div class="meta"><b>บันทึกเดิม:</b> ${tip.adminNote}</div>` : ''}`;

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
$('closeDetailBtn').addEventListener('click', () => $('detailCard').classList.add('hidden'));
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(KEY_STORAGE);
  adminKey = '';
  showLogin();
});

if (adminKey) {
  tryLogin();
}

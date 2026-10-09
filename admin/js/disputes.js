// Extracted from /admin/disputes.html (inline <script> removed for CSP without 'unsafe-inline').
const KEY_STORAGE = 'spaminthai_admin_key';
let adminKey = localStorage.getItem(KEY_STORAGE) || '';
let relLabels = {}, contactLabels = {};
let currentId = null;

const $ = (id) => document.getElementById(id);

function headers() {
  return { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json' };
}

function statusBadge(s) {
  const map = { pending:'รอตรวจ', approved:'รับรองแล้ว', rejected:'ปฏิเสธ' };
  return `<span class="badge ${s}">${map[s] || s}</span>`;
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('th-TH'); } catch { return ts || '-'; }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  if (res.status === 401) throw new Error('unauthorized');
  return res;
}

async function loadRows() {
  const status = $('statusFilter').value;
  const url = status ? `/api/admin/disputes?status=${encodeURIComponent(status)}` : '/api/admin/disputes';
  const res = await api(url);
  const data = await res.json();
  relLabels = data.relationshipLabels || {};
  contactLabels = data.contactLabels || {};
  const rows = data.disputes || [];
  const body = $('rowsBody');
  body.innerHTML = '';
  $('emptyState').classList.toggle('hidden', rows.length > 0);
  rows.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtTime(d.created_at)}</td>
      <td><b>${esc(d.num) || '-'}</b><br><span class="meta">${esc(d.ref || '')}</span></td>
      <td>${esc(relLabels[d.relationship] || d.relationship || '-')}</td>
      <td><span class="reason-prev">${esc(d.reasonPreview || '')}</span></td>
      <td>${d.hasImage ? '📷' : '—'}</td>
      <td>${statusBadge(d.status || 'pending')}</td>
      <td><button class="btn-ghost btn-sm" type="button">ดู</button></td>`;
    tr.querySelector('button').addEventListener('click', () => openRow(d.id));
    body.appendChild(tr);
  });
}

async function openRow(id) {
  currentId = id;
  $('actionErr').classList.add('hidden');
  $('adminNote').value = '';
  const res = await api(`/api/admin/disputes/${id}`);
  const d = await res.json();
  $('adminNote').value = d.adminNote || '';

  let evidenceHtml = '';
  if (d.evidence_r2_key) {
    const blob = await (await api(`/api/admin/dispute-evidence/${id}`)).blob();
    const url = URL.createObjectURL(blob);
    evidenceHtml = `<div><b>ภาพหลักฐาน</b><br><img class="evidence-img" src="${url}" alt="หลักฐาน"></div>`;
  }

  const contact = d.contact_channel === 'none'
    ? 'ไม่ต้องติดต่อกลับ'
    : `${esc(contactLabels[d.contact_channel] || d.contact_channel)}${d.contact_value ? ' — ' + esc(d.contact_value) : ''}`;

  $('detailContent').innerHTML = `
    <div class="meta"><b>รหัสอ้างอิง:</b> ${esc(d.ref || d.id)}</div>
    <div class="meta"><b>เบอร์:</b> ${esc(d.num)}</div>
    <div class="meta"><b>ความสัมพันธ์:</b> ${esc(relLabels[d.relationship] || d.relationship)}</div>
    <div class="meta"><b>เวลายื่น:</b> ${fmtTime(d.created_at)}</div>
    <div class="meta"><b>สถานะ:</b> ${statusBadge(d.status || 'pending')}</div>
    <div><b>เหตุผล</b><p style="margin-top:6px;white-space:pre-wrap">${esc(d.reason || '-')}</p></div>
    ${evidenceHtml}
    <div class="meta"><b>ช่องทางติดต่อกลับ:</b> ${contact}</div>
    ${d.adminNote ? `<div class="meta"><b>บันทึกเดิม:</b> ${esc(d.adminNote)}</div>` : ''}`;

  $('detailCard').classList.remove('hidden');
  $('detailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function setStatus(status) {
  if (!currentId) return;
  const note = $('adminNote').value.trim();
  if (!note) { $('actionErr').classList.remove('hidden'); return; }
  $('actionErr').classList.add('hidden');
  await api(`/api/admin/disputes/${currentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
  await loadRows();
  await openRow(currentId);
}

function showApp() { $('loginCard').classList.add('hidden'); $('app').classList.remove('hidden'); }
function showLogin() { $('loginCard').classList.remove('hidden'); $('app').classList.add('hidden'); }

async function tryLogin() {
  adminKey = $('adminKey').value;
  try {
    const res = await api('/api/admin/disputes?status=pending');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'admin_not_configured') {
        $('configErr').classList.remove('hidden'); $('loginErr').classList.add('hidden');
      } else {
        $('loginErr').classList.remove('hidden'); $('configErr').classList.add('hidden');
      }
      throw new Error('bad');
    }
    localStorage.setItem(KEY_STORAGE, adminKey);
    $('loginErr').classList.add('hidden'); $('configErr').classList.add('hidden');
    showApp();
    await loadRows();
  } catch {
    if (!$('configErr').classList.contains('hidden')) return;
    $('loginErr').classList.remove('hidden');
    showLogin();
  }
}

$('loginBtn').addEventListener('click', tryLogin);
$('adminKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
$('refreshBtn').addEventListener('click', loadRows);
$('statusFilter').addEventListener('change', loadRows);
$('approveBtn').addEventListener('click', () => setStatus('approved'));
$('rejectBtn').addEventListener('click', () => setStatus('rejected'));
$('closeDetailBtn').addEventListener('click', () => $('detailCard').classList.add('hidden'));
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(KEY_STORAGE);
  adminKey = '';
  showLogin();
});

if (adminKey) tryLogin();

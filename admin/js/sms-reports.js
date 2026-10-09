// Extracted from /admin/sms-reports.html (inline <script> removed for CSP without 'unsafe-inline').
const KEY_STORAGE = 'spaminthai_admin_key';
let adminKey = localStorage.getItem(KEY_STORAGE) || '';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (ts) => { try { return new Date(ts).toLocaleString('th-TH'); } catch { return ts || '-'; } };

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'X-Admin-Key': adminKey, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (res.status === 401) throw new Error('unauthorized');
  return res;
}
function badge(s) { return `<span class="badge ${s}">${({pending:'รอตรวจ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ'})[s] || s}</span>`; }

async function loadRows() {
  const status = $('statusFilter').value;
  const res = await api('/admin/api/sms-reports' + (status ? `?status=${encodeURIComponent(status)}` : ''));
  const rows = (await res.json()).reports || [];
  const body = $('rowsBody'); body.innerHTML = '';
  $('emptyState').classList.toggle('hidden', rows.length > 0);
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const actions = r.status === 'pending'
      ? `<button class="btn-ok btn-sm" data-a="approve">✓ อนุมัติ</button> <button class="btn-primary btn-sm" data-a="reject">✗ ปฏิเสธ</button>`
      : '';
    tr.innerHTML = `<td>${fmt(r.created_at)}</td>
      <td><span class="hash">${esc((r.hash || '').slice(0, 16))}…</span></td>
      <td>${esc(r.reasonPreview || '')}</td>
      <td>${badge(r.status || 'pending')}</td>
      <td>${actions}</td>`;
    tr.querySelectorAll('button[data-a]').forEach((b) =>
      b.addEventListener('click', () => review(r.id, b.getAttribute('data-a'))));
    body.appendChild(tr);
  });
}
async function review(id, action) {
  await api(`/admin/api/sms-reports/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
  await loadRows();
}
function showApp() { $('loginCard').classList.add('hidden'); $('app').classList.remove('hidden'); }
function showLogin() { $('loginCard').classList.remove('hidden'); $('app').classList.add('hidden'); }

async function tryLogin() {
  adminKey = $('adminKey').value || adminKey;
  try {
    const res = await api('/admin/api/sms-reports?status=pending');
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      if (d.error === 'admin_not_configured') { $('configErr').classList.remove('hidden'); }
      else { $('loginErr').classList.remove('hidden'); }
      throw new Error('bad');
    }
    localStorage.setItem(KEY_STORAGE, adminKey);
    $('loginErr').classList.add('hidden'); $('configErr').classList.add('hidden');
    showApp(); await loadRows();
  } catch {
    if (!$('configErr').classList.contains('hidden')) return;
    showLogin();
  }
}
$('loginBtn').addEventListener('click', tryLogin);
$('adminKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
$('refreshBtn').addEventListener('click', loadRows);
$('statusFilter').addEventListener('change', loadRows);
$('logoutBtn').addEventListener('click', () => { localStorage.removeItem(KEY_STORAGE); adminKey = ''; showLogin(); });
if (adminKey) tryLogin();

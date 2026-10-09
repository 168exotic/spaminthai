// Extracted from /admin/live.html (inline <script> removed for CSP without 'unsafe-inline').
const KEY_STORAGE = 'spaminthai_admin_key';
const REFRESH_MS = 30000;
let adminKey = localStorage.getItem(KEY_STORAGE) || '';
let timer = null, countdown = REFRESH_MS / 1000;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(path) {
  const res = await fetch(path, { headers: { 'X-Admin-Key': adminKey } });
  if (res.status === 401) throw new Error('unauthorized');
  return res;
}

function fmtNum(n) { return (n == null ? 0 : n).toLocaleString('th-TH'); }

function drawChart(hourly) {
  const svg = $('chart');
  const W = 720, H = 200, padL = 8, padB = 22, padT = 10;
  const data = hourly || [];
  const max = Math.max(1, ...data.map((h) => h.count || 0));
  const n = data.length || 1;
  const stepX = (W - padL * 2) / Math.max(1, n - 1);
  const scaleY = (H - padB - padT) / max;
  const pts = data.map((h, i) => {
    const x = padL + i * stepX;
    const y = H - padB - (h.count || 0) * scaleY;
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = pts.length
    ? `M${pts[0][0].toFixed(1)},${(H - padB)} ` + pts.map((p) => 'L' + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + ` L${pts[pts.length - 1][0].toFixed(1)},${(H - padB)} Z`
    : '';
  // hour labels every 4 buckets
  let labels = '';
  data.forEach((h, i) => {
    if (i % 4 === 0 || i === n - 1) {
      const x = padL + i * stepX;
      const hh = (h.hour || '').slice(-2);
      labels += `<text class="axis" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${hh}</text>`;
    }
  });
  svg.innerHTML =
    `<path d="${area}" fill="rgba(244,63,94,.15)"/>` +
    `<path d="${line}" fill="none" stroke="#f43f5e" stroke-width="2"/>` +
    labels;
}

function renderVersions(dist) {
  const card = $('versionCard'), note = $('versionNote'), list = $('versionList');
  if (!dist || Object.keys(dist).length === 0) { note.classList.remove('hidden'); list.innerHTML = ''; return; }
  note.classList.add('hidden');
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  list.innerHTML = entries.map(([v, c]) =>
    `<div style="display:flex;align-items:center;gap:10px;margin:6px 0">
       <span style="width:64px" class="meta">${esc(v)}</span>
       <span style="flex:1;background:#0b1220;border-radius:6px;overflow:hidden"><span style="display:block;height:14px;width:${(c / max * 100).toFixed(1)}%;background:var(--accent)"></span></span>
       <b style="width:56px;text-align:right">${fmtNum(c)}</b>
     </div>`).join('');
}

async function load() {
  const res = await api('/admin/api/live-stats');
  if (!res.ok) throw new Error('bad');
  const d = await res.json();
  $('liveNow').textContent = fmtNum(d.live_now);
  $('a24').textContent = fmtNum(d.active_24h);
  $('a7').textContent = fmtNum(d.active_7d);
  drawChart(d.hourly);
  renderVersions(d.version_dist);
  const t = d.last_updated ? new Date(d.last_updated) : new Date();
  $('updated').dataset.base = 'อัพเดตล่าสุด: ' + t.toLocaleTimeString('th-TH');
  countdown = REFRESH_MS / 1000;
}

function tick() {
  countdown -= 1;
  const base = $('updated').dataset.base || 'อัพเดตล่าสุด: –';
  $('updated').textContent = `${base} · รีเฟรชใน ${Math.max(0, countdown)} วิ`;
  if (countdown <= 0) { load().catch(() => {}); }
}

function showApp() { $('loginCard').classList.add('hidden'); $('app').classList.remove('hidden'); }
function showLogin() { $('loginCard').classList.remove('hidden'); $('app').classList.add('hidden'); }

async function tryLogin() {
  adminKey = $('adminKey').value || adminKey;
  try {
    const res = await api('/admin/api/live-stats');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'admin_not_configured') { $('configErr').classList.remove('hidden'); $('loginErr').classList.add('hidden'); }
      else { $('loginErr').classList.remove('hidden'); $('configErr').classList.add('hidden'); }
      throw new Error('bad');
    }
    localStorage.setItem(KEY_STORAGE, adminKey);
    $('loginErr').classList.add('hidden'); $('configErr').classList.add('hidden');
    showApp();
    await load();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  } catch {
    if (!$('configErr').classList.contains('hidden')) return;
    $('loginErr').classList.remove('hidden');
    showLogin();
  }
}

$('loginBtn').addEventListener('click', tryLogin);
$('adminKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
$('refreshBtn').addEventListener('click', () => load().catch(() => {}));
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(KEY_STORAGE); adminKey = '';
  if (timer) clearInterval(timer);
  showLogin();
});

if (adminKey) tryLogin();

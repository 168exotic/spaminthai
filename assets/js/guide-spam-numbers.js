// Extracted from /guide/spam-numbers.html (inline <script> removed for CSP without 'unsafe-inline').
function fmt(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.length >= 10) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  if (d.length >= 9) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6);
  return d;
}

async function load() {
  const list = document.getElementById('numList');
  const status = document.getElementById('status');
  try {
    const r = await fetch('/api/stats');
    const stats = r.ok ? await r.json() : {};
    const samples = ['021365777','026114777','0812345678','0999999999','020000000'];
    const items = [];
    for (const num of samples) {
      try {
        const lr = await fetch('/api/lookup?number='+num);
        const d = lr.ok ? await lr.json() : {reports:0};
        if (d.reports > 0) items.push({num, reports: d.reports, label: d.label || 'มีรายงาน'});
      } catch {}
    }
    status.remove();
    if (!items.length) {
      list.innerHTML = '<li><a href="/check/021365777">021-365-777 <span class="badge">เช็คเบอร์นี้ →</span></a></li>';
      return;
    }
    items.sort((a,b) => b.reports - a.reports);
    list.innerHTML = items.map(i =>
      '<li><a href="/check/'+i.num+'">'+fmt(i.num)+' <span class="badge">'+i.reports+' รายงาน · '+i.label+'</span></a></li>'
    ).join('');
  } catch {
    status.textContent = 'โหลดไม่สำเร็จ — ลองใหม่ภายหลัง';
  }
}
load();

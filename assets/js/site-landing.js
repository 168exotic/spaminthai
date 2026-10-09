// Extracted from /site/index.html (inline <script> removed for CSP without 'unsafe-inline').
const input = document.getElementById('numInput');
const btn = document.getElementById('checkBtn');
const box = document.getElementById('result');
const fullLink = document.getElementById('fullLink');
const clean = v => v.replace(/\D/g,'').slice(0,10);
const fmt = n => n.length > 6 ? n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6) : n;

input.addEventListener('input', () => {
  const d = clean(input.value);
  input.value = d.length > 6 ? d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6)
              : d.length > 3 ? d.slice(0,3)+'-'+d.slice(3) : d;
});
input.addEventListener('keydown', e => { if(e.key === 'Enter') doCheck(); });
btn.addEventListener('click', doCheck);

async function doCheck(){
  const num = clean(input.value);
  if(!SpamPhone.isValidThaiPhone(num)){ input.focus(); return; }
  btn.disabled = true; btn.textContent = 'กำลังเช็ค…';
  try{
    const r = await fetch('/api/lookup?number='+num);
    const data = r.ok ? await r.json() : {reports:0};
    render(num, data);
  }catch(e){
    render(num, {reports:0});
  }
  btn.disabled = false; btn.textContent = 'เช็คเบอร์';
}

function render(num, d){
  const n = d.reports || 0;
  const safeVotes = (d.categories && d.categories.safe) || 0;
  const badVotes = n - safeVotes;
  let cls, icon, title, sub;
  if(badVotes >= 5){ cls='danger'; icon='🚨'; title='เบอร์อันตราย'; sub='มีรายงานจำนวนมาก — ไม่ควรรับสาย'; }
  else if(badVotes >= 1){ cls='warn'; icon='⚠️'; title='เบอร์น่าสงสัย'; sub='มีคนรายงาน — รับสายด้วยความระมัดระวัง'; }
  else { cls='safe'; icon='🔍'; title='ยังไม่พบรายงาน'; sub='ไม่ได้แปลว่าปลอดภัย 100%'; }

  box.className = 'result show ' + cls;
  document.getElementById('rIcon').textContent = icon;
  document.getElementById('rTitle').textContent = title;
  const carrier = d.carrierLabel ? ' · '+d.carrierLabel : '';
  document.getElementById('rNum').textContent = fmt(num) + carrier + ' — ' + sub + (n ? ' ('+n+' รายงาน)' : '');
  fullLink.href = '/check?number=' + num;
}

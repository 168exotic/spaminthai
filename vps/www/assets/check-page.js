// Extracted from /vps/www/index.html (inline <script> removed for CSP without 'unsafe-inline').
const input = document.getElementById('numInput');
const btn = document.getElementById('checkBtn');
const box = document.getElementById('result');
let currentNum = '';

const clean = v => v.replace(/\D/g,'').slice(0,10);

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
  currentNum = num;
  btn.disabled = true; btn.textContent = 'กำลังเช็ค…';
  try{
    const r = await fetch('/api/lookup?number='+num);
    const data = r.ok ? await r.json() : {reports:0};
    render(num, data);
    history.replaceState(null,'','/check?number='+num);
    document.title = 'เบอร์ '+fmt(num)+' ใครโทรมา? เช็คเบอร์สแปม | SpamInThai';
  }catch(e){
    render(num, {reports:0, error:true});
  }
  btn.disabled = false; btn.textContent = 'เช็คเบอร์';
}

const fmt = n => n.length > 6 ? n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6) : n;

const CATS = {scam:'มิจฉาชีพ/หลอกโอนเงิน', callcenter:'แก๊งคอลเซ็นเตอร์', ads:'โฆษณา/ขายของ', loan:'เงินกู้', safe:'เบอร์ปกติ'};

function render(num, d){
  const n = d.reports || 0;
  const safeVotes = (d.categories && d.categories.safe) || 0;
  const badVotes = n - safeVotes;
  let cls, icon, title, sub;
  if(badVotes >= 5){ cls='danger'; icon='🚨'; title='เบอร์อันตราย — มีรายงานจำนวนมาก'; sub='ไม่ควรรับสาย และห้ามโอนเงินเด็ดขาด'; }
  else if(badVotes >= 1){ cls='warn'; icon='⚠️'; title='เบอร์น่าสงสัย — มีคนรายงาน'; sub='รับสายด้วยความระมัดระวัง'; }
  else { cls='safe'; icon='🔍'; title='ยังไม่พบรายงาน'; sub='ไม่ได้แปลว่าปลอดภัย 100% — มิจฉาชีพเปลี่ยนเบอร์บ่อย'; }

  box.className = 'result show ' + cls;
  document.getElementById('rIcon').textContent = icon;
  document.getElementById('rTitle').textContent = title;
  document.getElementById('rNum').textContent = fmt(num) + ' — ' + sub;

  document.getElementById('rStats').innerHTML =
    '<div class="stat"><b>'+n+'</b><small>รายงานทั้งหมด</small></div>' +
    (d.lastReport ? '<div class="stat"><b>'+new Date(d.lastReport).toLocaleDateString('th-TH',{day:'numeric',month:'short'})+'</b><small>รายงานล่าสุด</small></div>' : '');

  const tags = document.getElementById('rTags');
  tags.innerHTML = '';
  if(d.categories){
    Object.entries(d.categories).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
      if(v > 0 && CATS[k]) tags.innerHTML += '<span class="tag">'+CATS[k]+' × '+v+'</span>';
    });
  }
  document.querySelectorAll('.cat-btn').forEach(b => { b.classList.remove('sent'); b.disabled = false; });
}

document.getElementById('catRow').addEventListener('click', async e => {
  const b = e.target.closest('.cat-btn');
  if(!b || !currentNum) return;
  b.classList.add('sent'); b.textContent = '✓ รายงานแล้ว ขอบคุณ!';
  try{
    await fetch('/api/report', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({number: currentNum, category: b.dataset.cat})
    });
  }catch(e){}
});

const q = new URLSearchParams(location.search).get('number');
if(q){ input.value = fmt(clean(q)); doCheck(); }

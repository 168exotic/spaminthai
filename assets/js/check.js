// Extracted from /check.html (inline <script> removed for CSP without 'unsafe-inline').
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

document.getElementById('disputeBtn').addEventListener('click', (e) => {
  const num = clean(input.value);
  if (SpamPhone.isValidThaiPhone(num)) {
    e.preventDefault();
    location.href = '/dispute?num=' + encodeURIComponent(num);
  }
});

async function doCheck(){
  const num = clean(input.value);
  if(!SpamPhone.isValidThaiPhone(num)){ input.focus(); return; }
  currentNum = num;
  const tipLink = document.getElementById('reportTipLink');
  if (tipLink) tipLink.href = '/report?phone=' + encodeURIComponent(num);
  btn.disabled = true; btn.textContent = 'กำลังเช็ค…';
  try{
    const r = await fetch('/api/lookup?number='+num);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    if(!data || typeof data !== 'object' || data.ok === false) throw new Error('bad response');
    render(num, data);
    history.replaceState(null,'','/check?number='+num);
    document.title = 'เบอร์ '+fmt(num)+' ใครโทรมา? เช็คเบอร์สแปม | SpamInThai';
  }catch(e){
    renderError(num);
  }finally{
    btn.disabled = false; btn.textContent = 'เช็คเบอร์';
  }
}

// API failed (network, 429/5xx, bad JSON): never show "not found" or "safe".
function renderError(num){
  box.className = 'result show warn';
  document.getElementById('rIcon').textContent = '⚠️';
  document.getElementById('rTitle').textContent = 'เชื่อมต่อระบบตรวจเบอร์ไม่สำเร็จ ลองใหม่อีกครั้ง';
  document.getElementById('rNum').textContent = fmt(num) + ' — ยังตรวจสอบไม่ได้ ไม่ได้แปลว่าปลอดภัย';
  document.getElementById('rDispute').hidden = true;
  document.getElementById('rStats').innerHTML = '';
  document.getElementById('rTags').innerHTML = '';
  const shareBox = document.getElementById('shareBox');
  if (shareBox) shareBox.innerHTML = '';
}

const fmt = n => n.length > 6 ? n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6) : n;

const CATS = {scam:'มิจฉาชีพ/หลอกโอนเงิน', callcenter:'แก๊งคอลเซ็นเตอร์', ads:'โฆษณา/ขายของ', loan:'เงินกู้', safe:'เบอร์ปกติ'};

// Map the server verdict to a CSS class + icon. Falls back to a local
// computation when the API response predates server-side scoring.
const VMAP = {danger:{cls:'danger',icon:'🚨'}, caution:{cls:'warn',icon:'⚠️'}, safe:{cls:'safe',icon:'✅'}, unknown:{cls:'safe',icon:'🔍'}};

function render(num, d){
  const n = d.reports || 0;
  let verdict = d.verdict, title = d.label, sub = d.advice;
  if(!verdict){
    const safeVotes = (d.categories && d.categories.safe) || 0;
    const badVotes = n - safeVotes;
    if(badVotes >= 5){ verdict='danger'; title='เบอร์อันตราย — มีรายงานจำนวนมาก'; sub='ไม่ควรรับสาย และห้ามโอนเงินเด็ดขาด'; }
    else if(badVotes >= 1){ verdict='caution'; title='เบอร์น่าสงสัย — มีคนรายงาน'; sub='รับสายด้วยความระมัดระวัง'; }
    else if(n > 0){ verdict='safe'; title='น่าจะเป็นเบอร์ปกติ'; sub='มีผู้ใช้ยืนยันว่าเป็นเบอร์ปกติ'; }
    else { verdict='unknown'; title='ยังไม่พบรายงาน'; sub='ไม่ได้แปลว่าปลอดภัย 100% — มิจฉาชีพเปลี่ยนเบอร์บ่อย'; }
  }
  const v = VMAP[verdict] || VMAP.unknown;

  box.className = 'result show ' + v.cls;
  document.getElementById('rIcon').textContent = v.icon;
  document.getElementById('rTitle').textContent = title;
  document.getElementById('rNum').textContent = fmt(num) + ' — ' + sub;

  const disputeEl = document.getElementById('rDispute');
  if (d.disputed && d.disputed.status === 'approved') {
    disputeEl.textContent = '⚠️ เจ้าของเบอร์ได้โต้แย้งข้อมูลนี้ และทีมงาน spaminthai รับรองแล้ว — โปรดใช้วิจารณญาณ';
    disputeEl.hidden = false;
  } else {
    disputeEl.hidden = true;
  }

  const hasScore = typeof d.score === 'number' && n > 0;
  const carrierStat = d.carrierLabel
    ? '<div class="stat"><b>'+d.carrierLabel+'</b><small>เครือข่าย/ค่าย</small></div>'
    : '';
  const freshStat = d.freshnessLabel && (d.freshness === 'hot' || d.freshness === 'recent')
    ? '<div class="stat"><b>🔥</b><small>'+d.freshnessLabel+'</small></div>'
    : '';
  document.getElementById('rStats').innerHTML =
    carrierStat +
    freshStat +
    (hasScore ? '<div class="stat"><b>'+d.score+'<small style="font-size:.7rem">/100</small></b><small>คะแนนความเสี่ยง</small></div>' : '') +
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

  const shareBox = document.getElementById('shareBox');
  if (shareBox && window.SpamShare) {
    shareBox.innerHTML = '';
    if (n > 0 || verdict === 'danger' || verdict === 'caution') {
      SpamShare.injectShareBar(shareBox, {
        number: num,
        label: title,
        verdict,
        source: 'check',
        medium: 'share',
        campaign: 'check_result',
      });
    }
  }
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

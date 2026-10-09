// Extracted from /index.html (inline <script> removed for CSP without 'unsafe-inline').
const API_BASE = 'https://spaminthai.com';
let lastCheckedNumber = '';

function setPhone(n){
  document.getElementById('phoneInput').value=n;
  document.getElementById('checkForm').dispatchEvent(new Event('submit',{cancelable:true}));
}

document.getElementById('disputeBtn').addEventListener('click', (e) => {
  const num = String(document.getElementById('phoneInput').value).replace(/\D/g, '').replace(/^66/, '0');
  if (SpamPhone.isValidThaiPhone(num)) {
    e.preventDefault();
    location.href = '/dispute?num=' + encodeURIComponent(num);
  }
});

// Former inline handlers (onsubmit/onclick) — bound here so CSP needs no 'unsafe-inline'.
document.getElementById('checkForm').addEventListener('submit', (e) => { doCheck(e); });
document.querySelectorAll('[data-phone]').forEach((b) => {
  b.addEventListener('click', () => setPhone(b.dataset.phone));
});
document.querySelectorAll('[data-report-cat]').forEach((b) => {
  b.addEventListener('click', () => reportPhone(b.dataset.reportCat));
});

function fmt(n){
  n=String(n||'').replace(/\D/g,'');
  if(n.startsWith('66')) n='0'+n.slice(2);
  if(n.length===10) return n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6);
  if(n.length===9) return n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6);
  return n;
}

async function doCheck(ev){
  ev.preventDefault();
  const raw=document.getElementById('phoneInput').value;
  const num=String(raw).replace(/\D/g,'').replace(/^66/,'0');
  if(num.startsWith('0')){
    if(!SpamPhone.isValidThaiPhone(num)) return false;
  } else if(num.length<3){
    return false;
  }
  lastCheckedNumber=num;
  const btn=document.getElementById('checkBtn');
  btn.disabled=true;btn.innerHTML='<svg class="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity=".25" stroke-width="4"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg><span>กำลังตรวจ...</span>';
  try{
    const r=await fetch(API_BASE+'/api/lookup?number='+encodeURIComponent(num));
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(!d||typeof d!=='object'||d.ok===false) throw new Error('bad response');
    render(num,d);
  }catch(e){
    renderError(num);
  }finally{
    btn.disabled=false;btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg><span>ตรวจสอบเบอร์</span>';
  }
  return false;
}

// API failed (network, 429/5xx, bad JSON): never show "not found" or "safe".
function renderError(num){
  const box=document.getElementById('result');
  box.className='mt-6 p-5 rounded-2xl border bg-amber-50 border-amber-200 text-amber-800';
  document.getElementById('rIcon').textContent='⚠️';
  document.getElementById('rTitle').textContent='เชื่อมต่อระบบตรวจเบอร์ไม่สำเร็จ ลองใหม่อีกครั้ง';
  document.getElementById('rSub').textContent=fmt(num)+' — ยังตรวจสอบไม่ได้ ไม่ได้แปลว่าปลอดภัย';
  document.getElementById('rStats').innerHTML='';
  document.getElementById('rReport').classList.add('hidden');
  const shareBox=document.getElementById('shareBox');
  if(shareBox) shareBox.innerHTML='';
}

function render(num,d){
  const box=document.getElementById('result');
  const n=d.reports||0;
  let verdict=d.verdict,title=d.label,sub=d.advice;
  if(!verdict){
    const safeVotes=(d.categories&&d.categories.safe)||0;
    const badVotes=n-safeVotes;
    if(badVotes>=5){verdict='danger';title='เบอร์อันตราย';sub='มีรายงานจำนวนมาก — ไม่ควรรับสาย และห้ามโอนเงินเด็ดขาด';}
    else if(badVotes>=1){verdict='caution';title='เบอร์น่าสงสัย';sub='มีคนรายงาน — รับสายด้วยความระมัดระวัง';}
    else if(n>0){verdict='safe';title='น่าจะเป็นเบอร์ปกติ';sub='มีผู้ใช้ยืนยันว่าเป็นเบอร์ปกติ';}
    else{verdict='unknown';title='ยังไม่พบรายงาน';sub='ไม่ได้แปลว่าปลอดภัย 100% — มิจฉาชีพเปลี่ยนเบอร์บ่อย';}
  }
  const map={
    danger:{cls:'bg-red-50 border-red-200 text-red-800',icon:'🚨'},
    caution:{cls:'bg-amber-50 border-amber-200 text-amber-800',icon:'⚠️'},
    safe:{cls:'bg-green-50 border-green-200 text-green-800',icon:'✅'},
    unknown:{cls:'bg-slate-50 border-slate-200 text-slate-800',icon:'🔍'}
  };
  const v=map[verdict]||map.unknown;
  box.className='mt-6 p-5 rounded-2xl border '+v.cls;
  document.getElementById('rIcon').textContent=v.icon;
  document.getElementById('rTitle').textContent=fmt(num)+' — '+title;
  document.getElementById('rSub').textContent=sub;
  const hasScore=typeof d.score==='number'&&n>0;
  const carrierStat=d.carrierLabel
    ?'<div class="px-3 py-2 bg-white/60 rounded-lg border border-current/20"><b>'+d.carrierLabel+'</b> <small>เครือข่าย</small></div>'
    :'';
  const freshStat=d.freshnessLabel&&(d.freshness==='hot'||d.freshness==='recent')
    ?'<div class="px-3 py-2 bg-white/60 rounded-lg border border-current/20"><b>🔥</b> <small>'+d.freshnessLabel+'</small></div>'
    :'';
  document.getElementById('rStats').innerHTML=
    carrierStat+
    freshStat+
    (hasScore?'<div class="px-3 py-2 bg-white/60 rounded-lg border border-current/20"><b>'+d.score+'</b><small>/100 ความเสี่ยง</small></div>':'')+
    '<div class="px-3 py-2 bg-white/60 rounded-lg border border-current/20"><b>'+n+'</b> <small>รายงาน</small></div>'+
    (d.lastReport?'<div class="px-3 py-2 bg-white/60 rounded-lg border border-current/20"><small>รายงานล่าสุด: '+new Date(d.lastReport).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})+'</small></div>':'');
  document.getElementById('rReport').classList.remove('hidden');

  const shareBox = document.getElementById('shareBox');
  if (shareBox && window.SpamShare && (n > 0 || verdict === 'danger' || verdict === 'caution')) {
    shareBox.innerHTML = '';
    SpamShare.injectShareBar(shareBox, {
      number: num,
      label: title,
      verdict,
      source: 'home',
      medium: 'share',
      campaign: 'home_check',
    });
  } else if (shareBox) {
    shareBox.innerHTML = '';
  }
}

async function reportPhone(cat){
  if(!lastCheckedNumber)return;
  try{
    const r=await fetch(API_BASE+'/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:lastCheckedNumber,category:cat})});
    const d=await r.json();
    if(d.ok){
      const rn=d.deduped?'คุณเคยรายงานเบอร์นี้แล้ววันนี้':'ขอบคุณสำหรับรายงาน — เก็บเข้าฐานข้อมูลแล้ว ✅';
      alert(rn);
      doCheck(new Event('submit',{cancelable:true}));
    }else{
      alert('รายงานไม่สำเร็จ: '+(d.error||''));
    }
  }catch(e){alert('เกิดข้อผิดพลาด');}
}

// Live count from /api/stats + version from /api/version
(async()=>{
  try{
    const r=await fetch(API_BASE+'/api/stats');
    const d=await r.json();
    if(d&&d.numbers_in_db!=null){
      document.getElementById('reportCount').textContent=Number(d.numbers_in_db).toLocaleString('en-US');
    }
  }catch(e){}
  try{
    const r=await fetch(API_BASE+'/api/version');
    const d=await r.json();
    if(d&&d.version){
      document.getElementById('siteVer').textContent='v'+d.version;
    }
  }catch(e){}
  try{
    const r=await fetch(API_BASE+'/api/app');
    const d=await r.json();
    if(d&&d.version){
      document.getElementById('appVer').textContent='v'+d.version;
      const dlVer=document.getElementById('dlAppVer');
      if(dlVer) dlVer.textContent='v'+d.version;
      const dlNote=document.getElementById('dlAppNote');
      if(dlNote) dlNote.textContent='เวอร์ชันล่าสุดบน Google Play: '+d.version+(d.versionCode?' ('+d.versionCode+')':'');
    }
  }catch(e){}
})();

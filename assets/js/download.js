// Extracted from /download.html (inline <script> removed for CSP without 'unsafe-inline').
fetch('/api/app').then(r=>r.json()).then(d=>{
  document.getElementById('ver').textContent = 'เวอร์ชัน '+d.version+' · อัปเดต '+new Date(d.updatedAt).toLocaleDateString('th-TH');
}).catch(()=>{ document.getElementById('ver').textContent = ''; });

// Extracted from /report.html (inline <script> removed for CSP without 'unsafe-inline').
const params = new URLSearchParams(location.search);
const prefill = params.get('phone') || params.get('number');
if (prefill) document.getElementById('phone').value = prefill;

const form = document.getElementById('reportForm');
const btn = document.getElementById('submitBtn');
const box = document.getElementById('resultBox');
const imageInput = document.getElementById('evidenceImage');
const fileName = document.getElementById('fileName');
const filePreview = document.getElementById('filePreview');

const ERROR_MSG = {
  bad_json: 'ข้อมูลไม่ถูกต้อง กรุณาลองใหม่',
  invalid_number: 'เบอร์โทรไม่ถูกต้อง (กรอก 9–10 หลัก)',
  invalid_category: 'กรุณาเลือกประเภทพฤติกรรม',
  detail_too_short: 'รายละเอียดสั้นเกินไป กรุณาเล่าเพิ่มอีกนิด',
  consent_required: 'กรุณาติ๊กยืนยันความถูกต้องของข้อมูล',
  invalid_image_type: 'รูปหลักฐานต้องเป็น JPG, PNG หรือ WebP',
  image_too_large: 'รูปใหญ่เกิน 2MB กรุณาลดขนาดแล้วลองใหม่',
  image_required: 'กรุณาอัปโหลดภาพหลักฐาน',
  contact_required: 'กรุณากรอกช่องทางติดต่อกลับ',
  evidence_required: 'กรุณากรอกลิงก์หลักฐานเพิ่มเติม',
  invalid_evidence_url: 'ลิงก์หลักฐานไม่ถูกต้อง กรุณาใส่ URL ที่ขึ้นต้นด้วย https://',
};

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) {
    fileName.textContent = 'ยังไม่ได้เลือกไฟล์';
    filePreview.style.display = 'none';
    return;
  }
  const okType = /\.(jpe?g|png|webp)$/i.test(file.name) || /^image\/(jpeg|png|webp)/i.test(file.type);
  if (!okType) {
    alert('กรุณาเลือกรูป JPG, PNG หรือ WebP');
    imageInput.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert('ไฟล์ใหญ่เกิน 2MB');
    imageInput.value = '';
    return;
  }
  fileName.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
  filePreview.src = URL.createObjectURL(file);
  filePreview.style.display = 'block';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  box.className = 'result';
  box.textContent = '';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const contact = document.getElementById('contact').value.trim();
  const evidence = document.getElementById('evidence').value.trim();
  if (!contact) {
    box.className = 'result err';
    box.textContent = '❌ ' + ERROR_MSG.contact_required;
    document.getElementById('contact').focus();
    return;
  }
  if (evidence && !/^https?:\/\/.+/i.test(evidence)) {
    box.className = 'result err';
    box.textContent = '❌ ' + ERROR_MSG.invalid_evidence_url;
    document.getElementById('evidence').focus();
    return;
  }
  if (!imageInput.files[0]) {
    box.className = 'result err';
    box.textContent = '❌ ' + ERROR_MSG.image_required;
    document.getElementById('evidenceImage').focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'กำลังส่งข้อมูล...';

  const fd = new FormData();
  fd.append('phone', document.getElementById('phone').value.replace(/[^0-9+]/g, ''));
  fd.append('category', document.getElementById('category').value);
  fd.append('detail', document.getElementById('detail').value.trim());
  fd.append('evidence', evidence);
  fd.append('contact', contact);
  fd.append('consent', document.getElementById('consent').checked ? 'true' : 'false');
  fd.append('ts', new Date().toISOString());
  fd.append('evidenceImage', imageInput.files[0]);

  try {
    const res = await fetch('/api/report', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = ERROR_MSG[data.error] || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      throw new Error(msg);
    }
    box.className = 'result ok';
    box.textContent = '✅ ส่งเบาะแสเรียบร้อยแล้ว ขอบคุณที่ช่วยกันเตือนภัยสังคม ทีมงานจะตรวจสอบข้อมูลก่อนเผยแพร่';
    form.reset();
    fileName.textContent = 'ยังไม่ได้เลือกไฟล์';
    filePreview.style.display = 'none';
  } catch (err) {
    box.className = 'result err';
    box.textContent = '❌ ' + (err.message || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือแจ้งผ่าน admin@spaminthai.com');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚨 ส่งเบาะแส';
  }
});

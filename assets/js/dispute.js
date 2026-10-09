// Extracted from /dispute.html (inline <script> removed for CSP without 'unsafe-inline').
const $ = (id) => document.getElementById(id);
const ERR_TH = {
  invalid_number: 'เบอร์ไม่ถูกต้อง — มือถือ 10 หลัก / เบอร์บ้าน 9 หลัก',
  invalid_relationship: 'กรุณาเลือกความสัมพันธ์กับเบอร์นี้',
  reason_too_short: 'เหตุผลสั้นเกินไป — อย่างน้อย 30 ตัวอักษร',
  reason_too_long: 'เหตุผลยาวเกินไป',
  invalid_contact_channel: 'กรุณาเลือกช่องทางให้ติดต่อกลับ',
  email_required: 'กรุณากรอกอีเมลของคุณ',
  invalid_email: 'อีเมลไม่ถูกต้อง',
  invalid_image_type: 'ชนิดไฟล์ภาพไม่รองรับ (ใช้ JPG/PNG/WebP/HEIC)',
  image_too_large: 'ไฟล์ภาพใหญ่เกิน 2MB',
  rate_limited: 'ส่งคำโต้แย้งบ่อยเกินไป กรุณาลองใหม่ในอีก 1 ชั่วโมง',
  captcha_failed: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่',
  bad_request: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  server_error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
};
const CHANNEL_TH = { line: 'LINE @spaminthai', email: 'อีเมล', none: '' };

// Prefill number from ?num
const preNum = new URLSearchParams(location.search).get('num');
if (preNum) $('num').value = preNum.replace(/\D/g, '');

$('num').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
$('reason').addEventListener('input', () => { $('rcount').textContent = $('reason').value.length; });

// Channel selection styling + conditional email field
$('channelRadios').addEventListener('change', () => {
  const val = (document.querySelector('input[name=channel]:checked') || {}).value;
  document.querySelectorAll('.radio').forEach((r) => {
    r.classList.toggle('sel', r.querySelector('input').checked);
  });
  $('emailField').classList.toggle('hidden', val !== 'email');
});

function selectedChannel() {
  return (document.querySelector('input[name=channel]:checked') || {}).value || '';
}

$('disputeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('formErr').textContent = '';

  const num = $('num').value.replace(/\D/g, '');
  const relationship = $('relationship').value;
  const reason = $('reason').value.trim();
  const channel = selectedChannel();
  const email = $('contactEmail').value.trim();

  // Client-side validation mirrors the server.
  if (!SpamPhone.isValidThaiPhone(num)) return fail('invalid_number');
  if (!relationship) return fail('invalid_relationship');
  if (reason.length < 30) return fail('reason_too_short');
  if (!channel) return fail('invalid_contact_channel');
  if (channel === 'email' && !email) return fail('email_required');

  const fd = new FormData();
  fd.append('num', num);
  fd.append('relationship', relationship);
  fd.append('reason', reason);
  fd.append('contact_channel', channel);
  if (channel === 'email') fd.append('contact_value', email);
  const file = $('evidence').files[0];
  if (file) fd.append('evidence', file);

  const btn = $('submitBtn');
  btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  try {
    const res = await fetch('/api/dispute', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      $('refCode').textContent = data.ref || 'DSP-------';
      const chTxt = CHANNEL_TH[channel];
      $('successMsg').textContent = 'ทีมงานจะรีวิวภายใน 24-48 ชั่วโมง'
        + (chTxt ? ' และแจ้งผลผ่าน ' + chTxt : '');
      $('formView').classList.add('hidden');
      $('successView').classList.remove('hidden');
      window.scrollTo(0, 0);
      return;
    }
    fail(data.error || 'server_error');
  } catch {
    fail('server_error');
  } finally {
    btn.disabled = false; btn.textContent = 'ส่งคำโต้แย้ง';
  }
});

function fail(code) {
  $('formErr').textContent = ERR_TH[code] || ERR_TH.server_error;
}

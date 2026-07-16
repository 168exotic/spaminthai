// ตรวจสอบและ normalize เบอร์โทรไทย — ฝั่ง server เท่านั้น (ห้ามเชื่อ client)

const THAI_PHONE_RE = /^(0[689]\d{8}|02\d{7}|0[3-7]\d{7,8}|1\d{3})$/;

/** ตัดอักขระที่ไม่ใช่ตัวเลข แล้วแปลง +66 → 0 */
export function normalizePhone(raw) {
  let s = String(raw || '').replace(/[\s\-().]/g, '');
  if (s.startsWith('+66')) s = '0' + s.slice(3);
  else if (s.startsWith('66') && s.length >= 11) s = '0' + s.slice(2);
  return s.replace(/\D/g, '');
}

/** ตรวจว่าเป็นรูปแบบเบอร์ไทยที่ถูกต้อง */
export function isValidThaiPhone(phone) {
  return THAI_PHONE_RE.test(phone);
}

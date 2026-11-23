// Province-specific scam-awareness context for /<province> pages.
// Each province gets the scam patterns that fit its situation (tourism, border,
// industrial estates, farming), so pages are not one template with the name swapped.
// Patterns describe well-documented scam types only — no accusations against
// any person, business or place.

const TOURISM = new Set([
  'bangkok', 'chiang-mai', 'chiang-rai', 'phuket', 'krabi', 'phang-nga', 'surat-thani', 'chonburi',
  'prachuap-khiri-khan', 'phetchaburi', 'kanchanaburi', 'ayutthaya', 'trat', 'rayong', 'mae-hong-son',
  'nan', 'sukhothai', 'loei', 'satun', 'trang', 'songkhla', 'nakhon-ratchasima', 'chanthaburi', 'ranong',
]);
const BORDER = new Set([
  'chiang-rai', 'chiang-mai', 'mae-hong-son', 'tak', 'kanchanaburi', 'ratchaburi', 'prachuap-khiri-khan',
  'chumphon', 'ranong', 'phayao', 'nan', 'uttaradit', 'phitsanulok', 'loei', 'nong-khai', 'bueng-kan',
  'nakhon-phanom', 'mukdahan', 'amnat-charoen', 'ubon-ratchathani', 'sisaket', 'surin', 'buriram',
  'sa-kaeo', 'chanthaburi', 'trat', 'songkhla', 'satun', 'yala', 'narathiwat',
]);
const INDUSTRIAL = new Set([
  'chonburi', 'rayong', 'chachoengsao', 'samut-prakan', 'samut-sakhon', 'pathum-thani', 'ayutthaya',
  'prachinburi', 'saraburi', 'nakhon-pathom', 'nonthaburi', 'lamphun', 'bangkok',
]);
const METRO = new Set(['bangkok', 'nonthaburi', 'pathum-thani', 'samut-prakan']);

/** Ordered list of {title, text} notes for a province. Always returns 2–4 items. */
export function provinceNotes(p) {
  const out = [];
  const s = p.slug;
  if (TOURISM.has(s)) {
    out.push({
      title: `จองที่พักและทัวร์ใน${p.th}ปลอม`,
      text: `${p.th}เป็นจังหวัดที่มีนักท่องเที่ยวมาก รูปแบบที่พบบ่อยคือเพจหรือบัญชี LINE ปลอมที่ใช้รูปและชื่อคล้ายโรงแรม รีสอร์ต เรือทัวร์ หรือรถเช่าจริง แล้วให้โอนมัดจำเข้าบัญชีบุคคล ก่อนโอนควรจองผ่านเว็บไซต์ทางการหรือแอปจองที่เชื่อถือได้ ตรวจว่าชื่อบัญชีรับเงินตรงกับชื่อกิจการ และโทรยืนยันกับเบอร์ที่ประกาศบนเว็บไซต์ทางการของที่พักเอง`,
    });
  }
  if (BORDER.has(s)) {
    out.push({
      title: 'ชวนไปทำงานต่างประเทศ รายได้สูง',
      text: `${p.th}เป็นจังหวัดชายแดน มีรายงานการชักชวนทางโซเชียลให้ไปทำงานประเทศเพื่อนบ้าน เช่น งานแอดมิน งานคาสิโน หรืองานพิมพ์เอกสาร โดยอ้างรายได้สูงและออกค่าเดินทางให้ บางกรณีผู้ถูกชักชวนถูกบังคับให้ทำงานแก๊งคอลเซ็นเตอร์ ก่อนตกลงควรตรวจสอบกับกรมการจัดหางาน (สายด่วน 1694) ว่าบริษัทจัดหางานได้รับอนุญาตหรือไม่`,
    });
  }
  if (INDUSTRIAL.has(s)) {
    out.push({
      title: 'งานโรงงานปลอมและแอปเงินกู้ด่วน',
      text: `${p.th}มีนิคมและโรงงานจำนวนมาก มิจฉาชีพมักโพสต์รับสมัครงานโรงงานปลอมที่ให้จ่ายค่าสมัครหรือค่าตรวจสุขภาพล่วงหน้า และชวนกู้เงินผ่านแอปที่ไม่ได้รับอนุญาต ซึ่งขอสิทธิ์เข้าถึงรายชื่อผู้ติดต่อแล้วใช้ทวงหนี้ด้วยการประจาน ตรวจรายชื่อผู้ให้บริการสินเชื่อที่ได้รับอนุญาตได้จากเว็บไซต์ธนาคารแห่งประเทศไทย หรือโทร 1213`,
    });
  }
  if (METRO.has(s)) {
    out.push({
      title: 'โทรอ้างพัสดุผิดกฎหมายและหน่วยงานรัฐ',
      text: `เบอร์ ${p.code} เป็นรหัสของกรุงเทพฯ และปริมณฑล ซึ่งเป็นที่ตั้งของหน่วยงานรัฐและบริษัทขนส่งส่วนใหญ่ มิจฉาชีพจึงมักแสดงเบอร์ขึ้นต้น ${p.code} หรือเบอร์จากต่างประเทศ แล้วอ้างเป็นเจ้าหน้าที่ไปรษณีย์ บริษัทขนส่ง ตำรวจ หรือ DSI ว่าคุณมีพัสดุผิดกฎหมายหรือบัญชีเกี่ยวกับการฟอกเงิน หน่วยงานจริงไม่ให้โอนเงินเพื่อ "ตรวจสอบ" ทางโทรศัพท์`,
    });
  }
  if (out.length < 2) {
    out.push({
      title: 'SMS อ้างเงินช่วยเหลือและเงินคืน',
      text: `รูปแบบที่พบได้ทั่วประเทศ รวมถึงใน${p.th} คือ SMS หรือข้อความ LINE ที่อ้างว่าได้รับเงินช่วยเหลือเกษตรกร เงินคืนภาษี เงินชดเชยค่าไฟ หรือสิทธิ์โครงการรัฐ แล้วแนบลิงก์ให้กรอกข้อมูลบัตรประชาชนและบัญชีธนาคาร หน่วยงานรัฐไม่ส่งลิงก์ให้กรอกข้อมูลทาง SMS ให้ตรวจสิทธิ์ผ่านแอปทางรัฐหรือเว็บไซต์ทางการที่ลงท้ายด้วย .go.th เท่านั้น`,
    });
  }
  if (out.length < 2) {
    out.push({
      title: 'โทรอ้างเป็นญาติหรือคนรู้จัก',
      text: `อีกรูปแบบที่พบได้ทั่วไปคือโทรหรือทัก LINE อ้างเป็นลูกหลาน ญาติ หรือเพื่อนที่เปลี่ยนเบอร์ใหม่ แล้วขอยืมเงินด่วน ควรวางสายแล้วโทรกลับเบอร์เดิมที่บันทึกไว้ หรือถามเรื่องที่รู้กันเฉพาะในครอบครัวก่อนโอนเงิน`,
    });
  }
  return out.slice(0, 4);
}

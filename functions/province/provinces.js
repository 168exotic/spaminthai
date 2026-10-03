// 77 Thai provinces (76 + Bangkok) with landline area codes.
// Used by /<province> SEO pages and /thailand index on spaminthai.com.
// Slugs match 2ndhandsinthai.com/<province> for consistency.

export const REGIONS = [
  ['กรุงเทพฯ และปริมณฑล', [
    ['bangkok', 'Bangkok', 'กรุงเทพมหานคร', '02'],
    ['nonthaburi', 'Nonthaburi', 'นนทบุรี', '02'],
    ['pathum-thani', 'Pathum Thani', 'ปทุมธานี', '02'],
    ['samut-prakan', 'Samut Prakan', 'สมุทรปราการ', '02'],
    ['nakhon-pathom', 'Nakhon Pathom', 'นครปฐม', '034'],
    ['samut-sakhon', 'Samut Sakhon', 'สมุทรสาคร', '034'],
  ]],
  ['ภาคกลาง', [
    ['ang-thong', 'Ang Thong', 'อ่างทอง', '035'],
    ['ayutthaya', 'Ayutthaya', 'พระนครศรีอยุธยา', '035'],
    ['chai-nat', 'Chai Nat', 'ชัยนาท', '056'],
    ['lopburi', 'Lopburi', 'ลพบุรี', '036'],
    ['nakhon-nayok', 'Nakhon Nayok', 'นครนายก', '037'],
    ['samut-songkhram', 'Samut Songkhram', 'สมุทรสงคราม', '034'],
    ['saraburi', 'Saraburi', 'สระบุรี', '036'],
    ['sing-buri', 'Sing Buri', 'สิงห์บุรี', '036'],
    ['suphan-buri', 'Suphan Buri', 'สุพรรณบุรี', '035'],
    ['kamphaeng-phet', 'Kamphaeng Phet', 'กำแพงเพชร', '055'],
    ['nakhon-sawan', 'Nakhon Sawan', 'นครสวรรค์', '056'],
    ['phetchabun', 'Phetchabun', 'เพชรบูรณ์', '056'],
    ['phichit', 'Phichit', 'พิจิตร', '056'],
    ['phitsanulok', 'Phitsanulok', 'พิษณุโลก', '055'],
    ['sukhothai', 'Sukhothai', 'สุโขทัย', '055'],
    ['uthai-thani', 'Uthai Thani', 'อุทัยธานี', '056'],
  ]],
  ['ภาคเหนือ', [
    ['chiang-mai', 'Chiang Mai', 'เชียงใหม่', '053'],
    ['chiang-rai', 'Chiang Rai', 'เชียงราย', '053'],
    ['lampang', 'Lampang', 'ลำปาง', '054'],
    ['lamphun', 'Lamphun', 'ลำพูน', '053'],
    ['mae-hong-son', 'Mae Hong Son', 'แม่ฮ่องสอน', '053'],
    ['nan', 'Nan', 'น่าน', '054'],
    ['phayao', 'Phayao', 'พะเยา', '054'],
    ['phrae', 'Phrae', 'แพร่', '054'],
    ['uttaradit', 'Uttaradit', 'อุตรดิตถ์', '055'],
    ['tak', 'Tak', 'ตาก', '055'],
  ]],
  ['ภาคตะวันออกเฉียงเหนือ (อีสาน)', [
    ['amnat-charoen', 'Amnat Charoen', 'อำนาจเจริญ', '045'],
    ['bueng-kan', 'Bueng Kan', 'บึงกาฬ', '042'],
    ['buriram', 'Buriram', 'บุรีรัมย์', '044'],
    ['chaiyaphum', 'Chaiyaphum', 'ชัยภูมิ', '044'],
    ['kalasin', 'Kalasin', 'กาฬสินธุ์', '043'],
    ['khon-kaen', 'Khon Kaen', 'ขอนแก่น', '043'],
    ['loei', 'Loei', 'เลย', '042'],
    ['maha-sarakham', 'Maha Sarakham', 'มหาสารคาม', '043'],
    ['mukdahan', 'Mukdahan', 'มุกดาหาร', '042'],
    ['nakhon-phanom', 'Nakhon Phanom', 'นครพนม', '042'],
    ['nakhon-ratchasima', 'Nakhon Ratchasima', 'นครราชสีมา', '044'],
    ['nong-bua-lamphu', 'Nong Bua Lamphu', 'หนองบัวลำภู', '042'],
    ['nong-khai', 'Nong Khai', 'หนองคาย', '042'],
    ['roi-et', 'Roi Et', 'ร้อยเอ็ด', '043'],
    ['sakon-nakhon', 'Sakon Nakhon', 'สกลนคร', '042'],
    ['sisaket', 'Sisaket', 'ศรีสะเกษ', '045'],
    ['surin', 'Surin', 'สุรินทร์', '044'],
    ['ubon-ratchathani', 'Ubon Ratchathani', 'อุบลราชธานี', '045'],
    ['udon-thani', 'Udon Thani', 'อุดรธานี', '042'],
    ['yasothon', 'Yasothon', 'ยโสธร', '045'],
  ]],
  ['ภาคตะวันออก', [
    ['chachoengsao', 'Chachoengsao', 'ฉะเชิงเทรา', '038'],
    ['chanthaburi', 'Chanthaburi', 'จันทบุรี', '039'],
    ['chonburi', 'Chonburi', 'ชลบุรี', '038'],
    ['prachinburi', 'Prachinburi', 'ปราจีนบุรี', '037'],
    ['rayong', 'Rayong', 'ระยอง', '038'],
    ['sa-kaeo', 'Sa Kaeo', 'สระแก้ว', '037'],
    ['trat', 'Trat', 'ตราด', '039'],
  ]],
  ['ภาคตะวันตก', [
    ['kanchanaburi', 'Kanchanaburi', 'กาญจนบุรี', '034'],
    ['phetchaburi', 'Phetchaburi', 'เพชรบุรี', '032'],
    ['prachuap-khiri-khan', 'Prachuap Khiri Khan', 'ประจวบคีรีขันธ์', '032'],
    ['ratchaburi', 'Ratchaburi', 'ราชบุรี', '032'],
  ]],
  ['ภาคใต้', [
    ['chumphon', 'Chumphon', 'ชุมพร', '077'],
    ['krabi', 'Krabi', 'กระบี่', '075'],
    ['nakhon-si-thammarat', 'Nakhon Si Thammarat', 'นครศรีธรรมราช', '075'],
    ['narathiwat', 'Narathiwat', 'นราธิวาส', '073'],
    ['pattani', 'Pattani', 'ปัตตานี', '073'],
    ['phang-nga', 'Phang Nga', 'พังงา', '076'],
    ['phatthalung', 'Phatthalung', 'พัทลุง', '074'],
    ['phuket', 'Phuket', 'ภูเก็ต', '076'],
    ['ranong', 'Ranong', 'ระนอง', '077'],
    ['satun', 'Satun', 'สตูล', '074'],
    ['songkhla', 'Songkhla', 'สงขลา', '074'],
    ['surat-thani', 'Surat Thani', 'สุราษฎร์ธานี', '077'],
    ['trang', 'Trang', 'ตรัง', '075'],
    ['yala', 'Yala', 'ยะลา', '073'],
  ]],
];

export const PROVINCES = new Map();
for (const [region, list] of REGIONS) {
  for (const [slug, en, th, code] of list) PROVINCES.set(slug, { slug, en, th, code, region });
}

// Short/alternate spellings -> canonical slug (301).
export const ALIASES = (() => {
  const a = {
    bkk: 'bangkok', krungthep: 'bangkok', pattaya: 'chonburi', huahin: 'prachuap-khiri-khan',
    'hua-hin': 'prachuap-khiri-khan', samui: 'surat-thani', 'koh-samui': 'surat-thani',
    korat: 'nakhon-ratchasima', phangnhga: 'phang-nga', hatyai: 'songkhla', 'hat-yai': 'songkhla',
  };
  for (const slug of PROVINCES.keys()) {
    const c = slug.replace(/-/g, '');
    if (c !== slug && !PROVINCES.has(c)) a[c] = slug;
  }
  return a;
})();

/** Provinces sharing the same landline area code (excluding `slug`). */
export function sameCode(code, slug) {
  return [...PROVINCES.values()].filter((p) => p.code === code && p.slug !== slug);
}

// GET /download/police.vcf — Thai police hotline contacts (vCard)
const VCARD = `BEGIN:VCARD
VERSION:3.0
FN:ตำรวจไซเบอร์ (Cyber Crime)
TEL;TYPE=WORK,VOICE:1441
NOTE:สายด่วนตำรวจไซเบอร์ แจ้งมิจฉาชีพออนไลน์
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:แจ้งเหตุฉุกเฉิน
TEL;TYPE=WORK,VOICE:191
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:ศูนย์ป้องกันและปราบปรามอาชญากรรมทางเทคโนโลยี
TEL;TYPE=WORK,VOICE:1300
END:VCARD
`;

export async function onRequestGet() {
  return vcardResponse();
}

export async function onRequestHead() {
  return vcardResponse({ head: true });
}

function vcardResponse({ head = false } = {}) {
  const headers = {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Content-Disposition': 'attachment; filename="police.vcf"',
    'Cache-Control': 'public, max-age=86400'
  };
  return new Response(head ? null : VCARD, { status: 200, headers });
}

// Anti-scraping + honeytoken สำหรับ lookup

/** สุ่ม honeytoken field — ถ้าเจอที่อื่น = รู้ว่าใคร scrape */
export function addHoneytoken(data) {
  const tokens = ['_trace', '_meta', '_v'];
  const field = tokens[Math.floor(Math.random() * tokens.length)];
  const value = crypto.randomUUID().slice(0, 8);
  return { ...data, [field]: value };
}

/** strip HTML tags จาก detail */
export function stripHtml(str) {
  return String(str || '').replace(/<[^>]*>/g, '').trim();
}

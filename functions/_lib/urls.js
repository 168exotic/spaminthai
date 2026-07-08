const ALLOWED = new Set([
  'https://spaminthai.com',
  'https://www.spaminthai.com',
  'https://api.spaminthai.com',
  'https://xn--42c7b1ab1c2gya5e.com',
  'https://เบอร์ใคร.com'
]);

export function corsOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED.has(origin)) return origin;
  return 'https://spaminthai.com';
}

export const API_ORIGIN = 'https://api.spaminthai.com';
export const APK_URL = `${API_ORIGIN}/download/apk`;
export const POLICE_VCF_URL = `${API_ORIGIN}/download/police.vcf`;
export const CHECK_URL = 'https://xn--42c7b1ab1c2gya5e.com/';

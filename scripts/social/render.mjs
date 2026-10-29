// Render 1080x1080 social cards for marketing/social/posts.json → assets/social/<id>.png
// Usage: node scripts/social/render.mjs [repoRoot]   (needs playwright + chromium)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();
const { posts } = JSON.parse(readFileSync(join(root, 'marketing/social/posts.json'), 'utf8'));
const outDir = join(root, 'assets/social');
mkdirSync(outDir, { recursive: true });
const logo = 'data:image/png;base64,' + readFileSync(join(root, 'assets/logo-180.png')).toString('base64');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const html = (p) => `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1080px;font-family:'IBM Plex Sans Thai',sans-serif;background:#0f172a;color:#f8fafc;position:relative;overflow:hidden}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,#f43f5e55,transparent 65%);top:-380px;right:-320px}
.wrap{position:absolute;inset:0;padding:84px 88px;display:flex;flex-direction:column}
.tag{align-self:flex-start;background:#f43f5e;color:#fff;font-weight:700;font-size:34px;padding:10px 28px;border-radius:999px}
h1{font-size:80px;line-height:1.22;font-weight:700;margin:44px 0 40px;white-space:pre-line}
ul{list-style:none;display:flex;flex-direction:column;gap:22px}
li{font-size:38px;line-height:1.4;padding-left:58px;position:relative;color:#e2e8f0}
li:before{content:'';position:absolute;left:0;top:14px;width:30px;height:30px;border-radius:8px;background:#f43f5e}
.foot{margin-top:auto;display:flex;align-items:center;gap:20px;border-top:2px solid #334155;padding-top:30px}
.foot img{width:64px;height:64px;border-radius:14px}
.foot b{font-size:36px}.foot span{font-size:28px;color:#94a3b8;display:block}
</style></head><body><div class="glow"></div><div class="wrap">
<div class="tag">${esc(p.tag)}</div><h1>${esc(p.title)}</h1>
<ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<div class="foot"><img src="${logo}"><div><b>spaminthai.com</b><span>เช็คเบอร์มิจฉาชีพฟรี · แอปบล็อกสายบน Google Play</span></div></div>
</div></body></html>`;

const force = process.env.FORCE === '1';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const p of posts) {
  const out = join(outDir, `${p.id}.png`);
  if (existsSync(out) && !force) continue;
  await page.setContent(html(p), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'png' });
  console.log('rendered', out);
}
await browser.close();

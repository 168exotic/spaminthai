#!/usr/bin/env python3
"""Publish blog articles from spec files.

Usage (from repo root):
    python3 scripts/blog/publish.py scripts/blog/specs/<id>.py [...]
    python3 scripts/blog/publish.py --lint-only scripts/blog/specs/<id>.py

Each spec is a Python file defining:
    slug, date ('YYYY-MM-DD'), date_th ('3 พฤศจิกายน 2569'), title, desc (<=160 chars),
    faq = [(q, a), ...], main (HTML string), related (HTML links string),
    hero = (icon, accent_hex, chip_label, line1, line2)   # icon: see icons.py keys

For each spec it:
  1. lints legal/SEO rules (no real phone numbers, only existing internal links, length)
  2. writes blog/<slug>.html (header/footer copied from an existing article,
     hero image, share bars, Google Play box, Article + FAQPage JSON-LD)
  3. renders assets/blog/<slug>.webp + .jpg (1200x630) with Playwright
  4. prepends the post to BLOG_POSTS (functions/api/blog-posts.js),
     adds the slug to BLOG_SLUGS (functions/api/sitemap.js) and re-sorts blog/index.html cards
     to BLOG_POSTS order (newest at the top, oldest at the bottom)
Specs are published in the order given; the LAST one ends up newest (top of lists).
"""
import asyncio, html, importlib.util, io, json, os, re, sys
from urllib.parse import quote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from icons import I as ICONS  # noqa: E402

PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker'
TEMPLATE_ARTICLE = 'blog/02-landline-who-called.html'
STATIC_LINKS = {'/', '/check', '/report', '/dispute', '/editorial-policy', '/about', '/contact', '/privacy',
                '/terms', '/blog', '/news', '/guide/call-center-scam', '/guide/block-spam-android',
                '/guide/check-phone', '/guide/spam-numbers', '/prefix', '/monthly', '/thailand'}
OFFICIAL_SHORT = {'1111', '1129', '1130', '1125', '1155', '1161', '1186', '1200', '1202', '1207', '1212',
                  '1213', '1441', '1545', '1599', '1662', '1300', '1323', '1669', '191', '199', '1784'}


def load(path):
    spec = importlib.util.spec_from_file_location('spec_' + os.path.basename(path)[:-3], path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def existing_slugs():
    return {f[:-5] for f in os.listdir(os.path.join(ROOT, 'blog')) if f.endswith('.html') and f != 'index.html'}


def lint(m, new_slugs):
    errs = []
    for k in ('slug', 'date', 'date_th', 'title', 'desc', 'faq', 'main', 'related', 'hero'):
        if not hasattr(m, k):
            errs.append(f'missing {k}')
    if errs:
        return errs
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', m.slug):
        errs.append('bad slug')
    if len(m.desc) > 160:
        errs.append(f'desc too long ({len(m.desc)})')
    if m.hero[0] not in ICONS:
        errs.append(f'unknown icon {m.hero[0]}')
    body = m.main + ' ' + ' '.join(a for _, a in m.faq) + ' ' + m.related
    text = re.sub(r'<[^>]+>', ' ', body)
    if len(re.sub(r'\s+', '', text)) < 6000:
        errs.append(f'too short ({len(text)} chars)')
    for n in re.findall(r'(?<![\d/])(?:0\d[\d\- ]{7,11}\d|\+\d[\d\- ]{7,})', text):
        errs.append(f'phone-number-like text: {n}')
    for n in set(re.findall(r'(?<![\d.,/])(1\d{2,3})(?![\d.,/])', text)):
        if n not in OFFICIAL_SHORT and not (len(n) == 4 and n.startswith(('180', '25'))):
            errs.append(f'unverified short number: {n}')
    known = existing_slugs() | new_slugs
    for l in re.findall(r'href="(/[^"#?]*)', body):
        p = l.rstrip('/') or '/'
        if p.startswith('/blog/'):
            if p[6:] not in known:
                errs.append(f'broken blog link {l}')
        elif p not in STATIC_LINKS:
            errs.append(f'unknown internal link {l}')
    for l in re.findall(r'href="(https?://[^"]+)"', body):
        if 'play.google.com' in l and 'com.jarvis.callblocker' not in l:
            errs.append(f'wrong play link {l}')
    for bad in ('เป็นมิจฉาชีพแน่นอน', 'ไอ้', 'คนโกง'):
        if bad in text:
            errs.append(f'wording: {bad}')
    return errs


def chrome():
    t = open(os.path.join(ROOT, TEMPLATE_ARTICLE), encoding='utf-8').read()
    header = t[t.index('<header class="site-header">'):t.index('</header>') + 9]
    footer = t[t.index('<footer class="site-footer">'):t.index('</footer>') + 9]
    return header, footer


def share_bar(url, title, top=False):
    cls = 'share-bar share-bar--top' if top else 'share-bar'
    u = lambda src: quote(f'{url}?utm_source={src}&utm_medium=share&utm_campaign=blog', safe='')
    return (f'<div class="{cls}" data-url="{url}" data-title="{html.escape(title)}"><span>แชร์บทความนี้:</span>'
            f'<a class="s-line" href="https://social-plugins.line.me/lineit/share?url={u("line")}" target="_blank" rel="noopener noreferrer">LINE</a>'
            f'<a class="s-fb" href="https://www.facebook.com/sharer/sharer.php?u={u("facebook")}" target="_blank" rel="noopener noreferrer">Facebook</a>'
            f'<a class="s-x" href="https://x.com/intent/post?url={quote(url, safe="")}&amp;text={quote(title, safe="")}" target="_blank" rel="noopener noreferrer">X</a>'
            '<button type="button" class="s-copy">คัดลอกลิงก์</button><button type="button" class="s-native" hidden>แชร์…</button></div>')


def app_box(slug):
    return ('<aside class="app-cta"><img src="/assets/logo-180.webp" alt="แอป SpamInThai" width="96" height="96" loading="lazy">'
            '<div><h3>เตือนเบอร์มิจฉาชีพก่อนรับสาย</h3><p>แอป SpamInThai ใช้ฐานข้อมูลรายงานเดียวกับเว็บนี้ ขึ้นเตือนอัตโนมัติเมื่อเบอร์ที่โทรเข้ามีคนรายงาน ฟรี ไม่ต้องสมัคร</p>'
            f'<a class="play-btn" href="{PLAY}&amp;referrer=utm_source%3Dblog%26utm_medium%3Darticle%26utm_campaign%3D{slug}" target="_blank" rel="noopener noreferrer" data-download>ดาวน์โหลดบน Google Play</a></div></aside>')


def build_html(m, header, footer):
    url = f'https://spaminthai.com/blog/{m.slug}'
    img = f'https://spaminthai.com/assets/blog/{m.slug}.jpg'
    t = html.escape(m.title)
    d = html.escape(m.desc)
    faq_html = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in m.faq)
    body = f'''<article class="wrap" style="max-width:760px;margin:0 auto">
<p class="crumb"><a href="/">หน้าแรก</a> · <a href="/blog/">บทความ</a></p>
<h1>{t}</h1>
<p class="meta">เผยแพร่ {m.date_th} · ทีมงาน SpamInThai · อ้างอิง<a href="/editorial-policy">นโยบายการตรวจสอบข้อมูล</a></p>
<figure class="post-hero"><img src="/assets/blog/{m.slug}.webp" width="1200" height="630" alt="{t}" fetchpriority="high"></figure>
{share_bar(url, m.title, top=True)}
{m.main}
{app_box(m.slug)}
<h2>คำถามที่พบบ่อย</h2>
{faq_html}
<p style="margin-top:24px">อ่านต่อ: {m.related}</p>
{share_bar(url, m.title)}
</article>'''
    strip = lambda s: re.sub(r'<[^>]+>', '', s)
    ld = [
        {"@context": "https://schema.org", "@type": "Article", "image": img, "headline": m.title, "description": m.desc,
         "datePublished": m.date, "dateModified": m.date, "inLanguage": "th-TH",
         "author": {"@type": "Organization", "name": "SpamInThai", "url": "https://spaminthai.com/about"},
         "publisher": {"@type": "Organization", "name": "SpamInThai",
                       "logo": {"@type": "ImageObject", "url": "https://spaminthai.com/assets/logo.png"}},
         "mainEntityOfPage": url},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in m.faq]},
    ]
    return f'''<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="google-adsense-account" content="ca-pub-2455374115304550">
<title>{t} | SpamInThai</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{img}">
<link rel="icon" href="/assets/favicon.png" type="image/png" sizes="64x64">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/theme.css">
<link rel="stylesheet" href="/assets/layout.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2455374115304550" crossorigin="anonymous"></script>
<script src="/assets/ga4.js" defer></script>
</head>
<body class="site-body">
{header}
<main class="site-main site-main--wide">
{body}
</main>
{footer}
<script src="/assets/site.js"></script>
<script src="/assets/blog-share.js" defer></script>
</body>
</html>
'''


def hero_page(m):
    icon, acc, label, l1, l2 = m.hero
    fd = 'file://' + os.path.join(HERE, 'fonts') + '/'
    e = html.escape
    return f'''<html><head><style>
@font-face{{font-family:P;src:url({fd}ibm-plex-sans-thai-thai-700-normal.woff2);font-weight:700}}
@font-face{{font-family:P;src:url({fd}ibm-plex-sans-thai-thai-600-normal.woff2);font-weight:600}}
*{{margin:0;box-sizing:border-box}}body{{width:1200px;height:630px;font-family:P,sans-serif;color:#fff;
background:radial-gradient(circle at 85% 40%,{acc}33 0,transparent 45%),linear-gradient(135deg,#0b1020 0%,#111a33 60%,#0b1020 100%);position:relative;overflow:hidden}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:40px 40px}}
.l{{position:absolute;left:72px;top:0;bottom:0;width:700px;display:flex;flex-direction:column;justify-content:center;gap:22px}}
.chip{{align-self:flex-start;background:{acc};color:#0b1020;font-weight:700;font-size:30px;padding:8px 26px;border-radius:999px}}
h1{{font-weight:700;font-size:76px;line-height:1.25;white-space:nowrap}} h2{{font-weight:600;font-size:46px;line-height:1.3;color:#cbd5e1;white-space:nowrap}}
.brand{{position:absolute;left:72px;bottom:44px;font-weight:600;font-size:28px;color:#94a3b8}} .brand b{{color:#f43f5e}}
.ic{{position:absolute;right:90px;top:155px;width:320px;height:320px;color:{acc};filter:drop-shadow(0 0 30px {acc}66)}}
.ring{{position:absolute;right:40px;top:105px;width:420px;height:420px;border-radius:50%;border:3px solid {acc}55}}
</style></head><body><div class="grid"></div><div class="ring"></div>
<svg class="ic" viewBox="0 0 300 300">{ICONS[icon]}</svg>
<div class="l"><span class="chip">{e(label)}</span><h1>{e(l1)}</h1><h2>{e(l2)}</h2></div>
<div class="brand"><b>SpamIn</b>Thai · spaminthai.com</div></body></html>'''


async def render_heroes(mods):
    from playwright.async_api import async_playwright
    from PIL import Image
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 630})
        for m in mods:
            await pg.set_content(hero_page(m))
            await pg.evaluate('document.fonts.ready')
            # shrink headline/subline until each fits on one line beside the icon
            await pg.evaluate('''() => { for (const [sel, min] of [['h1', 44], ['h2', 30]]) {
                const el = document.querySelector(sel); let fs = parseFloat(getComputedStyle(el).fontSize);
                while (el.scrollWidth > 680 && fs > min) { fs -= 2; el.style.fontSize = fs + 'px'; } } }''')
            png = await pg.screenshot()
            im = Image.open(io.BytesIO(png)).convert('RGB')
            im.save(os.path.join(ROOT, 'assets/blog', f'{m.slug}.webp'), 'WEBP', quality=82)
            im.save(os.path.join(ROOT, 'assets/blog', f'{m.slug}.jpg'), 'JPEG', quality=85)
        await b.close()


def update_lists(m):
    # BLOG_POSTS (newest first)
    p = os.path.join(ROOT, 'functions/api/blog-posts.js')
    s = open(p, encoding='utf-8').read()
    mm = re.search(r'export const BLOG_POSTS = (\[.*?\n\]);', s, re.S)
    posts = [x for x in json.loads(mm.group(1)) if x['slug'] != m.slug]
    prev_top = None
    posts.insert(0, {'slug': m.slug, 'title': m.title, 'date': m.date, 'desc': m.desc})
    del prev_top
    s = s[:mm.start(1)] + json.dumps(posts, ensure_ascii=False, indent=2) + s[mm.end(1):]
    open(p, 'w', encoding='utf-8').write(s)
    # sitemap BLOG_SLUGS
    p = os.path.join(ROOT, 'functions/api/sitemap.js')
    s = open(p, encoding='utf-8').read()
    if f"'{m.slug}'" not in s:
        s = s.replace('const BLOG_SLUGS = [', f"const BLOG_SLUGS = [\n  '{m.slug}',", 1)
        open(p, 'w', encoding='utf-8').write(s)
    # blog/index.html: one card per post, in BLOG_POSTS order (newest top, oldest bottom)
    sync_index(posts, m)


def sync_index(posts, m=None):
    p = os.path.join(ROOT, 'blog/index.html')
    s = open(p, encoding='utf-8').read()
    lines = s.split('\n')
    card_idx = [i for i, l in enumerate(lines) if l.lstrip().startswith('<a class="card" href="/blog/')]
    first, last = card_idx[0], card_idx[-1]
    existing = {}
    for l in lines[first:last + 1]:
        mm = re.search(r'href="/blog/([a-z0-9-]+)"', l)
        if mm:
            existing[mm.group(1)] = l
    cards = []
    for x in posts:
        if x['slug'] in existing:
            cards.append(existing[x['slug']])
        else:
            d = x['desc'] if len(x['desc']) <= 90 else x['desc'][:88].rsplit(' ', 1)[0] + '…'
            cards.append(f'  <a class="card" href="/blog/{x["slug"]}"><h2>{html.escape(x["title"])}</h2><p>{html.escape(d)}</p></a>')
    lines[first:last + 1] = cards
    open(p, 'w', encoding='utf-8').write('\n'.join(lines))


def main(argv):
    lint_only = '--lint-only' in argv
    files = [a for a in argv if not a.startswith('--')]
    mods = [load(f) for f in files]
    new_slugs = {m.slug for m in mods if hasattr(m, 'slug')}
    bad = False
    for f, m in zip(files, mods):
        errs = lint(m, new_slugs)
        if hasattr(m, 'slug') and m.slug in existing_slugs():
            errs.append('slug already published')
        print(f'{f}: {"OK" if not errs else "FAIL"}')
        for e in errs:
            print('   -', e)
        bad |= bool(errs)
    if bad:
        sys.exit(1)
    if lint_only:
        return
    header, footer = chrome()
    for m in mods:
        open(os.path.join(ROOT, 'blog', f'{m.slug}.html'), 'w', encoding='utf-8').write(build_html(m, header, footer))
    asyncio.run(render_heroes(mods))
    for m in mods:
        update_lists(m)
    print('published:', ', '.join(m.slug for m in mods))


def resort_index():
    s = open(os.path.join(ROOT, 'functions/api/blog-posts.js'), encoding='utf-8').read()
    posts = json.loads(re.search(r'export const BLOG_POSTS = (\[.*?\n\]);', s, re.S).group(1))
    sync_index(posts)


if __name__ == '__main__':
    if sys.argv[1:] == ['--resort-index']:
        resort_index()
    else:
        main(sys.argv[1:])

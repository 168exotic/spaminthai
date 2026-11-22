// Site-wide page normalizer (Nov 2026, AdSense readiness).
// Runs on every public HTML response in _worker.js so static pages AND server-rendered pages
// (province, prefix, monthly, number, search, news…) all get the same:
//   1. cookie consent script first in <head>  (assets/consent.js — must run before ad/analytics tags)
//   2. AdSense verification meta + adsbygoogle.js in <head> if the page doesn't already have them
//   3. one canonical header menu (.site-nav / .site-header__mobile) — no duplicate Play links
//   4. the standard footer (Privacy, Terms, cookie settings, About, Editorial policy, Contact) if missing
//   5. layout.css pinned to the current version
// Pages keep their own content; only the shared chrome is normalized.

export const ADSENSE_CLIENT = 'ca-pub-2455374115304550';
export const LAYOUT_CSS_VERSION = '20261121';

const PLAY = 'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
const MULE = 'https://thaipoliceonline.go.th/login?redirectTo=%2Fmobile%2Fmule-account';

const NAV_HTML = `
      <a href="/check" class="site-nav__link site-nav__link--primary">เช็คเบอร์โทร</a>
      <a href="/news" class="site-nav__link">ข่าวสาร</a>
      <a href="/blog/" class="site-nav__link">บทความ</a>
      <a href="/report" class="site-nav__link">แจ้งเบาะแส</a>
      <a href="/#official" class="site-nav__link">เบอร์ทางการ</a>
      <a href="${MULE}" class="site-nav__link site-nav__link--mule" target="_blank" rel="noopener noreferrer">ตรวจสอบบัญชีม้า</a>
      <a class="site-nav__link site-nav__link--apk" data-download href="${PLAY}" target="_blank" rel="noopener noreferrer">ดาวน์โหลดบน Google Play</a>
    `;

const TABS_HTML = `
    <a href="/check" class="site-tab">เช็คเบอร์โทร</a>
    <a href="/news" class="site-tab">ข่าวสาร</a>
    <a href="/blog/" class="site-tab">บทความ</a>
    <a href="/#official" class="site-tab">เบอร์ทางการ</a>
    <a href="${MULE}" class="site-tab site-tab--mule" target="_blank" rel="noopener noreferrer">ตรวจสอบบัญชีม้า</a>
    <a href="${PLAY}" target="_blank" rel="noopener noreferrer" data-download class="site-tab site-tab--apk">ดาวน์โหลดบน Google Play</a>
  `;


// Standard site header for article pages that ship without one (blog/news articles).
const HEADER_HTML = `<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="site-brand">
      <picture class="site-brand__logo">
        <source srcset="/assets/logo-64.webp" type="image/webp">
        <img src="/assets/logo-64.png" alt="SpamInThai" width="40" height="40">
      </picture>
      <span class="site-brand__text">
        <span class="site-brand__title">SpamInThai</span>
        <span class="site-brand__tag">บล็อกสายมิจฉาชีพ · SMS · ลิงก์อันตราย</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="หลัก">${NAV_HTML}</nav>
  </div>
  <div class="site-header__mobile">${TABS_HTML}</div>
</header>
`;

const FOOTER_LINKS = `
      <a href="/check">เช็คเบอร์โทร</a>
      <a href="/thailand">เช็คเบอร์ 77 จังหวัด</a>
      <a href="/report">แจ้งเบาะแส</a>
      <a href="${PLAY}" target="_blank" rel="noopener noreferrer">ดาวน์โหลดแอป</a>
      <a href="/news">ข่าวสาร</a>
      <a href="/blog/">บทความ</a>
      <a href="https://t.me/spaminthaich" target="_blank" rel="noopener noreferrer">Telegram เตือนภัย</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="#" data-cookie-settings>ตั้งค่าคุกกี้</a>
      <a href="/about">เกี่ยวกับเรา</a>
      <a href="/editorial-policy">นโยบายการตรวจสอบข้อมูล</a>
      <a href="/contact">ติดต่อเรา</a>
      <a href="/dispute">โต้แย้งข้อมูล</a>`;

const FOOTER_INNER = `
  <div class="site-footer__inner">
    <div>
      <p class="site-footer__title">SpamInThai — หยุดสแปมในไทยร่วมกัน</p>
      <p class="site-footer__desc">ฐานข้อมูลเบอร์ร้องเรียน คัดกรองภัยสังคมออนไลน์ ด้วยพลังประชาชน</p>
      <p class="site-footer__copy">© 2026 spaminthai · Web <span id="siteVer">v1.3.0</span> · App <span id="appVer">v3.1.5</span></p>
    </div>
    <nav class="site-footer__links" aria-label="ลิงก์">${FOOTER_LINKS}
    </nav>
  </div>
`;
const FOOTER_HTML = `\n<footer class="site-footer">${FOOTER_INNER}</footer>\n`;

// Pages without layout.css get a self-contained footer so it never renders unstyled.
const FOOTER_FALLBACK_HTML = `
<style>.sit-footer{margin-top:48px;background:#0f172a;color:#cbd5e1;font:14px/1.6 system-ui,"IBM Plex Sans Thai",sans-serif}
.sit-footer__inner{max-width:80rem;margin:0 auto;padding:28px 20px;display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between}
.sit-footer__title{color:#fff;font-weight:700;margin:0 0 4px}.sit-footer p{margin:0 0 4px}
.sit-footer__links{display:flex;flex-wrap:wrap;gap:8px 16px;max-width:42rem}
.sit-footer__links a{color:#cbd5e1;text-decoration:none}.sit-footer__links a:hover{color:#fb7185;text-decoration:underline}</style>
<footer class="sit-footer site-footer--fallback">
  <div class="sit-footer__inner">
    <div>
      <p class="sit-footer__title">SpamInThai — หยุดสแปมในไทยร่วมกัน</p>
      <p>ฐานข้อมูลเบอร์ร้องเรียน คัดกรองภัยสังคมออนไลน์ ด้วยพลังประชาชน</p>
      <p>© 2026 spaminthai</p>
    </div>
    <nav class="sit-footer__links" aria-label="ลิงก์">${FOOTER_LINKS}
    </nav>
  </div>
</footer>
`;

/** Which top-level section a path belongs to, for server-side active menu highlighting. */
export function sectionOf(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/check' || p.startsWith('/check/')) return '/check';
  if (p === '/news' || p.startsWith('/news/') || /^\/news-\d+$/.test(p)) return '/news';
  if (p === '/blog' || p.startsWith('/blog/')) return '/blog/';
  if (p === '/report' || p.startsWith('/report/')) return '/report';
  return null;
}

function markActive(html, section, cls) {
  if (!section) return html;
  return html.replace(`href="${section}" class="${cls}`, `href="${section}" class="${cls} ${cls}--active`);
}

const CONSENT_TAG = '<script src="/assets/consent.js?v=1"></script>';
const ADSENSE_META = `<meta name="google-adsense-account" content="${ADSENSE_CLIENT}">`;
const ADSENSE_SCRIPT = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;

/**
 * AdSense must never receive personal data (PII). Ad tags send the page URL to Google, so pages whose
 * URL can carry a phone number (number lookups, searches) get NO adsbygoogle script — the verification
 * meta tag stays. See AdSense policy on PII.
 */
export function urlMayCarryPII(url) {
  const p = url.pathname;
  if (p === '/check' || p.startsWith('/check/') || p === '/search' || p.startsWith('/search/')) return true;
  for (const v of url.searchParams.values()) {
    if ((v.replace(/\D/g, '').length >= 6)) return true;
  }
  return false;
}

export function normalizePage(response, url) {
  if (typeof HTMLRewriter === 'undefined') return response;
  if (url.pathname.startsWith('/admin')) return response;
  if (response.status !== 200) return response;
  if (!/^\s*text\/html\b/i.test(response.headers.get('Content-Type') || '')) return response;

  const section = sectionOf(url.pathname);
  const navHtml = markActive(NAV_HTML, section, 'site-nav__link');
  const tabsHtml = markActive(TABS_HTML, section, 'site-tab');
  const headerHtml = HEADER_HTML.replace(NAV_HTML, navHtml).replace(TABS_HTML, tabsHtml);
  const noAds = urlMayCarryPII(url);
  const seen = { meta: false, ads: false, footer: false, layout: false, header: false };

  return new HTMLRewriter()
    .on('meta[name="google-adsense-account"]', { element() { seen.meta = true; } })
    .on('script[src*="adsbygoogle.js"]', { element(el) { seen.ads = true; if (noAds) el.remove(); } })
    .on('ins.adsbygoogle', { element(el) { if (noAds) el.remove(); } })
    .on('footer.site-footer', {
      element(el) {
        seen.footer = true;
        el.setInnerContent(FOOTER_INNER, { html: true });
      },
    })
    .on('header.site-header', { element() { seen.header = true; } })
    .on('body > article.wrap', {
      element(el) {
        if (!seen.header && seen.layout) {
          seen.header = true;
          el.before(headerHtml, { html: true });
        }
      },
    })
    .on('link[href^="/assets/layout.css"]', {
      element(el) {
        seen.layout = true;
        el.setAttribute('href', `/assets/layout.css?v=${LAYOUT_CSS_VERSION}`);
      },
    })
    .on('head', {
      element(el) {
        el.prepend(CONSENT_TAG, { html: true });
        el.onEndTag((end) => {
          let add = '';
          if (!seen.meta) add += ADSENSE_META + '\n';
          if (!seen.ads && !noAds) add += ADSENSE_SCRIPT + '\n';
          if (add) end.before(add, { html: true });
        });
      },
    })
    .on('.site-nav', { element(el) { el.setInnerContent(navHtml, { html: true }); } })
    .on('.site-header__mobile', { element(el) { el.setInnerContent(tabsHtml, { html: true }); } })
    .on('body', {
      element(el) {
        el.onEndTag((end) => {
          if (!seen.footer) end.before(seen.layout ? FOOTER_HTML : FOOTER_FALLBACK_HTML, { html: true });
        });
      },
    })
    .transform(response);
}

// SpamInThai cookie consent (PDPA) + Google Consent Mode v2.
// Loaded synchronously at the very top of <head> (injected by _worker.js) so the
// consent defaults are set before AdSense / GA4 tags run.
(function () {
  var COOKIE = 'sit_consent';
  var DAYS = 180;

  function read() {
    var m = document.cookie.match(/(?:^|;\s*)sit_consent=(all|necessary)/);
    return m ? m[1] : null;
  }

  function write(value) {
    var exp = new Date(Date.now() + DAYS * 864e5).toUTCString();
    document.cookie = COOKIE + '=' + value + '; expires=' + exp + '; path=/; SameSite=Lax; Secure';
  }

  function states(all) {
    var v = all ? 'granted' : 'denied';
    return { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v };
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  var saved = read();
  var defaults = states(saved === 'all');
  defaults.functionality_storage = 'granted';
  defaults.security_storage = 'granted';
  if (!saved) defaults.wait_for_update = 500;
  gtag('consent', 'default', defaults);
  gtag('set', 'ads_data_redaction', saved !== 'all');

  // AdSense: serve non-personalized ads unless the visitor accepted all cookies.
  window.adsbygoogle = window.adsbygoogle || [];
  if (saved !== 'all') window.adsbygoogle.requestNonPersonalizedAds = 1;

  function apply(value) {
    write(value);
    gtag('consent', 'update', states(value === 'all'));
    window.adsbygoogle.requestNonPersonalizedAds = value === 'all' ? 0 : 1;
    hide();
  }

  var CSS =
    '#sitConsent{position:fixed;left:12px;right:12px;bottom:12px;z-index:10001;max-width:720px;margin:0 auto;' +
    'background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.1);border-radius:16px;' +
    'box-shadow:0 12px 32px rgba(15,23,42,.35);padding:16px 18px;font:14px/1.6 system-ui,"IBM Plex Sans Thai",sans-serif}' +
    '#sitConsent p{margin:0 0 12px}#sitConsent a{color:#fb7185;text-decoration:underline}' +
    '#sitConsent .sc-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}' +
    '#sitConsent button{cursor:pointer;border-radius:10px;padding:9px 16px;font:600 14px system-ui,"IBM Plex Sans Thai",sans-serif;border:1px solid rgba(255,255,255,.2)}' +
    '#sitConsent .sc-all{background:#e11d48;border-color:#e11d48;color:#fff}' +
    '#sitConsent .sc-nec{background:transparent;color:#e2e8f0}';

  function show() {
    if (document.getElementById('sitConsent')) return;
    if (!document.getElementById('sitConsentCss')) {
      var st = document.createElement('style');
      st.id = 'sitConsentCss';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var box = document.createElement('div');
    box.id = 'sitConsent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'การตั้งค่าคุกกี้');
    box.innerHTML =
      '<p>เว็บไซต์นี้ใช้คุกกี้ที่จำเป็นเพื่อให้บริการทำงาน และขอความยินยอมใช้คุกกี้ของ Google (Analytics และ AdSense) ' +
      'เพื่อวัดสถิติการเข้าชมและแสดงโฆษณาที่เกี่ยวข้อง ซึ่งช่วยให้บริการเช็คเบอร์ฟรีต่อไปได้ ' +
      'เปลี่ยนใจได้ทุกเมื่อ อ่านเพิ่มเติมที่ <a href="/privacy#cookies">นโยบายความเป็นส่วนตัว</a></p>' +
      '<div class="sc-row"><button type="button" class="sc-nec">เฉพาะที่จำเป็น</button>' +
      '<button type="button" class="sc-all">ยอมรับทั้งหมด</button></div>';
    box.querySelector('.sc-nec').addEventListener('click', function () { apply('necessary'); });
    box.querySelector('.sc-all').addEventListener('click', function () { apply('all'); });
    document.body.appendChild(box);
  }

  function hide() {
    var el = document.getElementById('sitConsent');
    if (el) el.remove();
  }

  window.SpamInThaiConsent = { open: show, get: read };

  function init() {
    if (!read()) show();
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-cookie-settings]');
      if (t) {
        e.preventDefault();
        show();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

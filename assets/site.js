// Shared site utilities: APK download links + app install popup.
(function () {
  const FALLBACK =
    'https://github.com/168exotic/spaminthai/releases/download/v1.0.15/spaminthai-v1.0.15.apk';
  const POPUP_KEY = 'spaminthai_app_popup_dismissed';
  const POPUP_DAYS = 3;

  let downloadUrl = FALLBACK;

  function applyDownloadUrl(url) {
    downloadUrl = url;
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        if (url.endsWith('.apk')) el.setAttribute('download', '');
      }
    });
    const popupBtn = document.getElementById('appPopupDownload');
    if (popupBtn) popupBtn.href = url;
  }

  applyDownloadUrl(FALLBACK);

  fetch('/api/app')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.downloadUrl) applyDownloadUrl(data.downloadUrl);
    })
    .catch(() => {});

  function shouldShowPopup() {
    if (location.pathname.startsWith('/download') || location.pathname.startsWith('/report')) return false;
    try {
      const raw = localStorage.getItem(POPUP_KEY);
      if (!raw) return true;
      const dismissed = Number(raw);
      if (!Number.isFinite(dismissed)) return true;
      return Date.now() - dismissed > POPUP_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return true;
    }
  }

  function dismissPopup() {
    try {
      localStorage.setItem(POPUP_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    const el = document.getElementById('appPopup');
    if (el) {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 280);
    }
  }

  function injectPopup() {
    if (!shouldShowPopup() || document.getElementById('appPopup')) return;

    const style = document.createElement('style');
    style.textContent = `
#appPopup{position:fixed;top:0;left:0;right:0;z-index:10000;transform:translateY(0);animation:appPopSlideDown .35s cubic-bezier(.22,1,.36,1);font-family:system-ui,'IBM Plex Sans Thai',sans-serif}
#appPopup.hide{animation:appPopSlideUp .28s ease forwards;pointer-events:none}
#appPopupCard{display:flex;align-items:center;gap:10px;max-width:100%;margin:0 auto;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:linear-gradient(135deg,#0f172a,#1e293b);border-bottom:1px solid rgba(255,255,255,.08);box-shadow:0 8px 24px rgba(15,23,42,.28)}
@media(min-width:640px){#appPopupCard{gap:14px;padding:12px 20px;padding-top:max(12px,env(safe-area-inset-top))}}
@keyframes appPopSlideDown{from{transform:translateY(-110%)}to{transform:translateY(0)}}
@keyframes appPopSlideUp{from{transform:translateY(0)}to{transform:translateY(-110%)}}
#appPopupIcon{flex-shrink:0;width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#f43f5e,#e11d48);display:flex;align-items:center;justify-content:center;font-size:1.25rem}
#appPopupBody{flex:1;min-width:0}
#appPopupTitle{font-size:.88rem;font-weight:800;color:#fff;margin:0;line-height:1.3}
#appPopupDesc{font-size:.72rem;color:#94a3b8;margin:2px 0 0;line-height:1.35;display:none}
@media(min-width:480px){#appPopupDesc{display:block}}
#appPopupActions{display:flex;align-items:center;gap:8px;flex-shrink:0}
#appPopupDownload{display:inline-block;background:#f43f5e;color:#fff;font-weight:700;font-size:.78rem;padding:8px 14px;border-radius:99px;text-decoration:none;white-space:nowrap;box-shadow:0 2px 10px rgba(244,63,94,.35)}
#appPopupDownload:hover{background:#e11d48;color:#fff}
#appPopupClose{flex-shrink:0;border:none;background:rgba(255,255,255,.1);color:#cbd5e1;width:30px;height:30px;border-radius:99px;font-size:1rem;cursor:pointer;line-height:1}
#appPopupLater{display:none}
@media(prefers-reduced-motion:reduce){#appPopup{animation:none}#appPopup.hide{animation:none;opacity:0}}
`;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'appPopup';
    wrap.setAttribute('role', 'banner');
    wrap.setAttribute('aria-label', 'ดาวน์โหลดแอป SpamInThai');
    wrap.innerHTML = `
<div id="appPopupCard">
  <div id="appPopupIcon">🛡️</div>
  <div id="appPopupBody">
    <p id="appPopupTitle">ดาวน์โหลดแอป SpamInThai — บล็อกสายมิจฉาชีพอัตโนมัติ</p>
    <p id="appPopupDesc">ใช้ฐานข้อมูลเดียวกับเว็บ ก่อนโทรศัพท์จะดัง</p>
  </div>
  <div id="appPopupActions">
    <a id="appPopupDownload" data-download href="${downloadUrl}">ติดตั้งฟรี</a>
    <button id="appPopupClose" type="button" aria-label="ปิด">×</button>
  </div>
</div>`;
    document.body.appendChild(wrap);

    document.getElementById('appPopupClose').addEventListener('click', dismissPopup);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        dismissPopup();
        document.removeEventListener('keydown', onKey);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectPopup, 800));
  } else {
    setTimeout(injectPopup, 800);
  }
})();

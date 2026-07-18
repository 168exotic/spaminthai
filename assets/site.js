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
    if (location.pathname.startsWith('/download')) return false;
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
      setTimeout(() => el.remove(), 250);
    }
  }

  function injectPopup() {
    if (!shouldShowPopup() || document.getElementById('appPopup')) return;

    const style = document.createElement('style');
    style.textContent = `
#appPopup{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(15,23,42,.55);animation:appPopFade .25s ease}
#appPopup.hide{opacity:0;pointer-events:none;transition:opacity .25s ease}
#appPopupCard{width:100%;max-width:400px;background:#fff;border-radius:20px 20px 16px 16px;padding:22px 20px 18px;box-shadow:0 20px 50px rgba(15,23,42,.25);animation:appPopUp .3s ease;position:relative}
@media(min-width:640px){#appPopup{align-items:center}#appPopupCard{border-radius:20px;padding:24px}}
@keyframes appPopFade{from{opacity:0}to{opacity:1}}
@keyframes appPopUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
#appPopupClose{position:absolute;top:10px;right:12px;border:none;background:#f1f5f9;color:#64748b;width:32px;height:32px;border-radius:99px;font-size:1.1rem;cursor:pointer;line-height:1}
#appPopupIcon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#f43f5e,#e11d48);display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:12px}
#appPopup h2{font-family:system-ui,'IBM Plex Sans Thai',sans-serif;font-size:1.15rem;font-weight:800;color:#0f172a;margin:0 0 6px}
#appPopup p{font-family:system-ui,'IBM Plex Sans Thai',sans-serif;font-size:.9rem;color:#64748b;margin:0 0 16px;line-height:1.55}
#appPopupDownload{display:block;text-align:center;background:#f43f5e;color:#fff;font-family:system-ui,'IBM Plex Sans Thai',sans-serif;font-weight:700;font-size:1rem;padding:13px 20px;border-radius:99px;text-decoration:none;box-shadow:0 4px 14px rgba(244,63,94,.35)}
#appPopupDownload:hover{background:#e11d48;color:#fff}
#appPopupLater{display:block;width:100%;margin-top:10px;border:none;background:none;color:#94a3b8;font-family:system-ui,'IBM Plex Sans Thai',sans-serif;font-size:.85rem;cursor:pointer;padding:8px}
@media(prefers-reduced-motion:reduce){#appPopup,#appPopupCard{animation:none}}
`;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'appPopup';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'appPopupTitle');
    wrap.innerHTML = `
<div id="appPopupCard">
  <button id="appPopupClose" type="button" aria-label="ปิด">×</button>
  <div id="appPopupIcon">🛡️</div>
  <h2 id="appPopupTitle">ดาวน์โหลดแอป SpamInThai</h2>
  <p>บล็อกเบอร์มิจฉาชีพและแก๊งคอลเซ็นเตอร์อัตโนมัติ ก่อนโทรศัพท์จะดัง — ใช้ฐานข้อมูลเดียวกับเว็บ</p>
  <a id="appPopupDownload" data-download href="${downloadUrl}">ติดตั้งฟรีบน Android</a>
  <button id="appPopupLater" type="button">ไว้ทีหลัง</button>
</div>`;
    document.body.appendChild(wrap);

    document.getElementById('appPopupClose').addEventListener('click', dismissPopup);
    document.getElementById('appPopupLater').addEventListener('click', dismissPopup);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) dismissPopup();
    });
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

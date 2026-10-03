// App download links for www.เบอร์ใคร.com (VPS-hosted frontend).
// Always Google Play (site policy: no APK links). Fetches version from spaminthai.com.
(function () {
  const FALLBACK =
    'https://play.google.com/store/apps/details?id=com.jarvis.callblocker';
  const APP_API = 'https://spaminthai.com/api/app';

  function applyDownloadUrl(url) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        el.removeAttribute('download');
      }
    });
    const ver = document.getElementById('appVer');
    if (ver) {
      const m = url.match(/v(\d+\.\d+\.\d+)/);
      if (m) ver.textContent = 'v' + m[1];
    }
  }

  applyDownloadUrl(FALLBACK);

  fetch(APP_API)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.downloadUrl) applyDownloadUrl(data.downloadUrl);
      if (data?.version) {
        const ver = document.getElementById('appVer');
        if (ver) ver.textContent = 'v' + data.version;
      }
    })
    .catch(() => {});
})();

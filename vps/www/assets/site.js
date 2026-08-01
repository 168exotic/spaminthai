// APK download links for www.เบอร์ใคร.com (VPS-hosted frontend).
// Fetches latest metadata from spaminthai.com; falls back to pinned release.
(function () {
  const FALLBACK =
    'https://github.com/168exotic/spaminthai/releases/download/v2.0.3/spaminthai-v2.0.3.apk';
  const APP_API = 'https://spaminthai.com/api/app';

  function applyDownloadUrl(url) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        if (url.endsWith('.apk')) el.setAttribute('download', '');
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

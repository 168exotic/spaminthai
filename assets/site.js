// Shared download link wiring for all pages.
(function () {
  // APK is served from the VPS (nginx sends Content-Disposition: attachment),
  // not from Pages: the file exceeds the 25 MiB Pages per-file limit.
  const FALLBACK = 'https://api.spaminthai.com/download/apk';

  function apply(url) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
      }
    });
  }

  apply(FALLBACK);

  fetch('/api/app')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.downloadUrl) apply(data.downloadUrl);
    })
    .catch(() => {});
})();

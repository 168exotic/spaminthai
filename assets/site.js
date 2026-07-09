// Shared download link wiring for all pages.
(function () {
  const FALLBACK = 'https://api.spaminthai.com/download/apk';

  function apply(url) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        if (url.endsWith('.apk')) el.setAttribute('download', '');
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

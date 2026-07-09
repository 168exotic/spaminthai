// Shared download link wiring for all pages.
(function () {
  const FALLBACK_DOWNLOAD = '/download/police.vcf';

  function apply(url, { ready = false } = {}) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        if (url.endsWith('.apk') || url.endsWith('.vcf')) {
          el.setAttribute('download', '');
        } else {
          el.removeAttribute('download');
        }

        const label = ready ? el.dataset.readyLabel : el.dataset.pendingLabel;
        if (label) el.textContent = label;
      }
    });
  }

  apply(FALLBACK_DOWNLOAD);

  fetch('/api/app')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.status === 'available' && data?.downloadUrl) {
        apply(data.downloadUrl, { ready: true });
      } else {
        apply(data?.fallbackDownloadUrl || FALLBACK_DOWNLOAD);
      }
    })
    .catch(() => {});
})();

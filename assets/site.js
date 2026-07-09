// Wire download / police / check links from /api/app (no hardcoded Google Drive on pages).
(function () {
  const API = 'https://api.spaminthai.com';
  const CHECK = 'https://xn--42c7b1ab1c2gya5e.com/';
  const POLICE = API + '/download/police.vcf';

  function wireDownload(url) {
    document.querySelectorAll('[data-download]').forEach((el) => {
      if (el.tagName === 'A') {
        el.href = url;
        el.setAttribute('download', '');
      }
    });
  }

  function wirePolice() {
    document.querySelectorAll('[data-police-vcf]').forEach((el) => {
      if (el.tagName === 'A') el.href = POLICE;
    });
  }

  function wireCheck() {
    document.querySelectorAll('[data-check-url]').forEach((el) => {
      if (el.tagName === 'A') el.href = CHECK;
    });
  }

  function wireVersion(data) {
    document.querySelectorAll('[data-app-version]').forEach((el) => {
      if (!data?.version) return;
      const when = data.updatedAt
        ? new Date(data.updatedAt).toLocaleDateString('th-TH')
        : '';
      el.textContent = when
        ? `เวอร์ชัน ${data.version} · อัปเดต ${when}`
        : `เวอร์ชัน ${data.version}`;
    });
  }

  wireCheck();
  wirePolice();

  fetch(API + '/api/app')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.downloadUrl) return;
      wireDownload(data.downloadUrl);
      wireVersion(data);
    })
    .catch(() => {});
})();

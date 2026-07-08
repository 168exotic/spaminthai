// Shared download + check URLs for all pages
(function () {
  const API = 'https://api.spaminthai.com';
  const APK = API + '/download/apk';
  const POLICE = API + '/download/police.vcf';
  const CHECK = 'https://xn--42c7b1ab1c2gya5e.com/';

  document.querySelectorAll('[data-download]').forEach((el) => {
    if (el.tagName === 'A') {
      el.href = APK;
      el.setAttribute('download', '');
    }
  });

  document.querySelectorAll('[data-police-vcf]').forEach((el) => {
    if (el.tagName === 'A') el.href = POLICE;
  });

  document.querySelectorAll('[data-check-url]').forEach((el) => {
    if (el.tagName === 'A') el.href = CHECK;
  });

  fetch(API + '/api/app')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.downloadUrl) {
        document.querySelectorAll('[data-download]').forEach((el) => {
          if (el.tagName === 'A') el.href = data.downloadUrl;
        });
      }
    })
    .catch(() => {});
})();

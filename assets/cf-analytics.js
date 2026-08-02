// Cloudflare Web Analytics — privacy-friendly, no cookies.
(function () {
  if (document.querySelector('script[data-cf-beacon]')) return;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute(
    'data-cf-beacon',
    JSON.stringify({ token: '61b52e6dd1dc4e3682ac12f84342cbbb' })
  );
  document.head.appendChild(script);
})();

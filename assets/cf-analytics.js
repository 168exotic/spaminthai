// Cloudflare Web Analytics — privacy-friendly beacon for spaminthai.com
(function () {
  const TOKEN = '61b52e6dd1dc4e3682ac12f84342cbbb';
  if (document.querySelector('script[data-cf-beacon]')) return;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(script);
})();

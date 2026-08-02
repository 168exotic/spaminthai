// Cloudflare Web Analytics for spaminthai.com
// https://developers.cloudflare.com/analytics/web-analytics/
(function () {
  var s = document.createElement('script');
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.type = 'module';
  s.setAttribute(
    'data-cf-beacon',
    JSON.stringify({ token: '61b52e6dd1dc4e3682ac12f84342cbbb' })
  );
  document.head.appendChild(s);
})();

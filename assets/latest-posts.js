// Homepage "บทความล่าสุด": refresh the 3 static fallback cards from /api/blog/latest.
(function () {
  var grid = document.querySelector('[data-latest-posts]');
  if (!grid || !window.fetch) return;
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  fetch('/api/blog/latest?n=3', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.items || !data.items.length) return;
      grid.innerHTML = data.items.map(function (p) {
        return '<a class="latest-card" href="' + esc(p.url) + '"><img src="' + esc(p.image) + '" alt="' + esc(p.title) +
          '" width="1200" height="630" loading="lazy"><span class="latest-card__body"><span class="latest-card__title">' + esc(p.title) +
          '</span><span class="latest-card__desc">' + esc(p.desc) + '</span></span></a>';
      }).join('');
    })
    .catch(function () {});
})();

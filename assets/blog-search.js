// /blog?q=... — filter article cards by the search text (from the header search box).
(function () {
  var q = new URLSearchParams(location.search).get('q');
  var cards = document.querySelectorAll('a.card[href^="/blog/"]');
  if (!cards.length) return;
  var box = document.createElement('div');
  box.className = 'blog-filter';
  box.innerHTML = '<input type="search" class="blog-filter__input" placeholder="ค้นหาบทความ เช่น SMS พัสดุ, ซิม, LINE" aria-label="ค้นหาบทความ"><p class="blog-filter__count" aria-live="polite"></p>';
  var first = cards[0];
  first.parentNode.insertBefore(box, first);
  var input = box.querySelector('input'), count = box.querySelector('p');
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function run() {
    var terms = norm(input.value).split(' ').filter(Boolean), shown = 0;
    cards.forEach(function (c) {
      var t = norm(c.textContent), ok = terms.every(function (w) { return t.indexOf(w) !== -1; });
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    count.textContent = terms.length ? (shown ? 'พบ ' + shown + ' บทความ' : 'ไม่พบบทความที่ตรงกับคำค้น ลองคำอื่น หรือเช็คเบอร์ที่ /check') : '';
  }
  input.addEventListener('input', run);
  if (q) { input.value = q; run(); }
})();

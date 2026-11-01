// Blog share bar: copy link + native share (Web Share API). LINE/FB/X are plain links.
(function () {
  document.querySelectorAll('.share-bar').forEach(function (bar) {
    var url = bar.getAttribute('data-url'), title = bar.getAttribute('data-title') || document.title;
    var copy = bar.querySelector('.s-copy'), nat = bar.querySelector('.s-native');
    if (copy) copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'คัดลอกแล้ว'; setTimeout(function () { copy.textContent = 'คัดลอกลิงก์'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('คัดลอกลิงก์', url); });
      else window.prompt('คัดลอกลิงก์', url);
    });
    if (nat) {
      if (navigator.share) { nat.hidden = false; nat.addEventListener('click', function () { navigator.share({ title: title, url: url }).catch(function () {}); }); }
      else nat.hidden = true;
    }
  });
})();

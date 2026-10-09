/**
 * Facebook post embeds: scale the fixed-size plugin iframe down to the container width
 * and only set iframe.src (from data-src) when it scrolls near the viewport.
 * Markup: .fb-embed__scaler > iframe[data-src]. Supports any number of embeds; no-op if none.
 */
(function () {
  'use strict';
  var scalers = document.querySelectorAll('.fb-embed__scaler');
  if (!scalers.length) return;

  function setup(scaler) {
    var iframe = scaler.querySelector('iframe[data-src]');
    if (!iframe) return;
    var baseW = parseInt(iframe.getAttribute('width'), 10) || 500;
    var baseH = parseInt(iframe.getAttribute('height'), 10) || 485;

    function fit() {
      var w = scaler.clientWidth;
      if (!w) return;
      var scale = Math.min(w / baseW, 1);
      iframe.style.transform = 'scale(' + scale + ')';
      scaler.style.height = Math.round(baseH * scale) + 'px';
    }

    function load() {
      if (iframe.getAttribute('src')) return;
      var src = iframe.getAttribute('data-src');
      if (!src || src.indexOf('https://www.facebook.com/') !== 0) return;
      iframe.setAttribute('src', src);
      fit();
    }

    window.addEventListener('resize', fit);
    iframe.addEventListener('load', fit);
    fit();

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            load();
            io.disconnect();
          }
        });
      }, { rootMargin: '250px' });
      io.observe(scaler);
    } else {
      load();
    }
  }

  for (var i = 0; i < scalers.length; i++) setup(scalers[i]);
})();

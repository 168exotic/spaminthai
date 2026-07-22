// Floating LINE @spaminthai add-friend widget — shared across public pages.
// Included via <script src="/assets/line-widget.js" defer></script>.
// Self-contained: injects its own <style> + button, no external requests.
(function () {
  // Never show on admin pages.
  if (location.pathname.indexOf('/admin') === 0) return;

  var LINE_URL = 'https://line.me/R/ti/p/@spaminthai';

  function inject() {
    if (document.getElementById('lineFab')) return; // no double-inject

    var style = document.createElement('style');
    style.textContent = [
      // z-index 9998: above page content, below the app popup banner (10000) so it never covers a modal/banner
      '.line-fab{position:fixed;right:20px;bottom:20px;bottom:max(20px,env(safe-area-inset-bottom));z-index:9998;animation:lineFabBob 2s ease-in-out infinite;will-change:transform}',
      '@media(min-width:640px){.line-fab{right:24px;bottom:24px;bottom:max(24px,env(safe-area-inset-bottom))}}',
      '.line-fab__btn{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#06C755;box-shadow:0 6px 18px rgba(6,199,85,.45);text-decoration:none;-webkit-tap-highlight-color:transparent;transition:transform .18s ease,box-shadow .18s ease}',
      '@media(min-width:640px){.line-fab__btn{width:64px;height:64px}}',
      '.line-fab__btn:hover{transform:scale(1.05);box-shadow:0 10px 24px rgba(6,199,85,.55)}',
      '.line-fab__btn:focus-visible{outline:3px solid #06C755;outline-offset:3px}',
      '.line-fab__btn svg{width:62%;height:62%;display:block}',
      '@keyframes lineFabBob{0%{transform:translateY(0)}25%{transform:translateY(-6px)}50%{transform:translateY(0)}75%{transform:translateY(6px)}100%{transform:translateY(0)}}',
      '@media(prefers-reduced-motion:reduce){.line-fab{animation:none}}',
    ].join('');
    document.head.appendChild(style);

    var fab = document.createElement('div');
    fab.className = 'line-fab';
    fab.id = 'lineFab';
    fab.innerHTML =
      '<a class="line-fab__btn" href="' + LINE_URL + '" target="_blank" rel="noopener" aria-label="เพิ่มเพื่อน LINE @spaminthai">' +
        '<svg viewBox="0 0 44 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
          '<rect x="2" y="3" width="40" height="30" rx="9" fill="#fff"></rect>' +
          '<path d="M14 32h6l-5 7z" fill="#fff"></path>' +
          '<text x="22" y="23" text-anchor="middle" font-family="Arial,\'Helvetica Neue\',sans-serif" font-weight="800" font-size="12.5" letter-spacing=".3" fill="#06C755">LINE</text>' +
        '</svg>' +
      '</a>';
    document.body.appendChild(fab);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

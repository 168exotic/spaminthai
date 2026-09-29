/**
 * SpamInThai — Affiliate Ad Placement (disabled)
 */
(function () {
  const AD_CONFIG = [];
  function inject() {
    AD_CONFIG.forEach(function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

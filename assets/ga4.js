// Google Analytics 4 — loads only when /api/site-config returns a measurement ID.
(function () {
  const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

  function loadGa4(measurementId) {
    const id = String(measurementId || '').trim();
    if (!/^G-[A-Z0-9]+$/i.test(id)) return;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, { anonymize_ip: true, send_page_view: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  fetch('/api/site-config', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.ga4MeasurementId) loadGa4(data.ga4MeasurementId);
    })
    .catch(() => {});
})();

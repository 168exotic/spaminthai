/**
 * SpamInThai — Affiliate Ad Placement
 * =====================================
 * ส่วนกลางการจัดการโฆษณา Affiliate ของเว็บ spaminthai.com
 *
 * วิธีใช้:
 *   1. เพิ่ม slot ใน HTML:  <div class="affiliate-slot" data-slot="sidebar-top"></div>
 *   2. ลงทะเบียนรายการโฆษณาใน AD_CONFIG (ใส่ href = ลิงก์ affiliate จริง)
 *
 * กติกา:
 *   - ถ้ายังไม่มี href จะแสดง placeholder (ไม่คลิกได้) จนกว่าจะใส่ลิงก์จริง
 *   - ทุกลิงก์ได้ rel="sponsored nofollow noopener" อัตโนมัติ
 *   - โฆษณากำกับด้วยป้าย "Sponsored / โฆษณา" เสมอ
 */
(function () {
  // ============ CONFIG: ใส่ / แก้โฆษณาได้ตรงนี้เท่านั้น ============
  const AD_CONFIG = [
    {
      slot: 'sidebar-top',
      enabled: true,
      href: '',
      image: '',
      badge: 'Sponsored',
      title: 'ผลิตภัณฑ์แนะนำ',
      desc: 'พื้นที่โฆษณา Affiliate — กำลังจัดเตรียมเนื้อหา',
      cta: 'ดูรายละเอียด',
    },
    {
      slot: 'below-result',
      enabled: true,
      href: '',
      image: '',
      badge: 'Sponsored',
      title: 'บริการแนะนำ',
      desc: 'พื้นที่โฆษณา Affiliate — กำลังจัดเตรียมเนื้อหา',
      cta: 'คลิกที่นี่',
    },
  ];
  // ============ END CONFIG ============

  function inject() {
    const slots = document.querySelectorAll('.affiliate-slot');
    if (!slots.length) return;
    AD_CONFIG.forEach(function (ad) {
      if (!ad || !ad.enabled) return;
      var slot = document.querySelector('.affiliate-slot[data-slot="' + ad.slot + '"]');
      if (!slot) return;
      slot.innerHTML = renderAd(ad);
    });
  }

  function renderAd(ad) {
    var href = String(ad.href || '').trim();
    var rel = 'rel="sponsored nofollow noopener"';
    var target = 'target="_blank"';
    var isPlaceholder = !href;
    var cls = isPlaceholder ? 'aff-card aff-card--placeholder' : 'aff-card';
    var linkAttr = isPlaceholder ? '' : ('href="' + esc(href) + '" ' + rel + ' ' + target);
    var image = '';
    if (ad.image) {
      image = '<img src="' + esc(ad.image) + '" alt="' + esc(ad.title) + '" class="aff-card__img" loading="lazy">';
    }
    return (
      '<div class="' + cls + '">' +
        (isPlaceholder ? '' : '<a ' + linkAttr + ' class="aff-card__link">') +
          (ad.badge ? '<span class="aff-card__badge">' + esc(ad.badge) + '</span>' : '') +
          image +
          '<div class="aff-card__body">' +
            '<div class="aff-card__title">' + esc(ad.title) + '</div>' +
            '<div class="aff-card__desc">' + esc(ad.desc) + '</div>' +
            (ad.cta ? '<div class="aff-card__cta">' + esc(ad.cta) + (isPlaceholder ? '' : ' →') + '</div>' : '') +
          '</div>' +
        (isPlaceholder ? '' : '</a>') +
      '</div>'
    );
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

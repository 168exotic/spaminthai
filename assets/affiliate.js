/**
 * SpamInThai — Affiliate Ad Placement
 * =====================================
 * ส่วนกลางการจัดการโฆษณา Affiliate ของเว็บ spaminthai.com
 *
 * วิธีใช้:
 *   เพิ่ม slot ใน HTML:  <div class="affiliate-slot" data-slot="sidebar-top"></div>
 *   แล้วลงทะเบียนรายการโฆษณาใน AD_CONFIG.map로 slot นี้ (ดูด้านล่าง)
 *
 * SEO / การเปิดเผยข้อมูล (นโยบาย Affiliate ที่ถูกต้อง):
 *   - ทุกลิงก์ได้ rel="sponsored nofollow noopener" อัตโนมัติ
 *   - โฆษณาจะแสดง label "Sponsored / โฆษณา" กำกับเสมอ
 *   - ถ้าลิงก์จริงยังไม่พร้อม ใช้ placeholder ที่มี class="aff-placeholder"
 *     (ไม่ขึ้น clickable จนกว่าจะใส่ href จริง) เพื่อไม่ให้เสีย SEO
 */
(function () {
  // ============ CONFIG: ใส่ / แก้โฆษณาได้ตรงนี้ ============
  const AD_CONFIG = [
    // ตัวอย่าง slot: sidebar-top
    {
      slot: 'sidebar-top',
      enabled: true,
      // ใส่ href = ลิงก์ affiliate จริงของบอส / ปล่อย '' = ขึ้นเป็น placeholder
      href: '',
      image: '',
      badge: 'Sponsored',
      title: 'พื้นที่โฆษณา SpamInThai',
      desc: 'ที่นี่เป็นจุดวางโฆษณา Affiliate — บอสส่งลิงก์มาให้ผมเติมได้ที่ /data/workspace หรือบอกโปรแกรม affiliate ได้เลย',
      cta: 'ดูรายละเอียด',
    },
    // ตัวอย่าง slot: below-result (ใต้ผลตรวจเบอร์)
    {
      slot: 'below-result',
      enabled: true,
      href: '',
      image: '',
      badge: 'Sponsored',
      title: 'แบนเนอร์ Affiliate ที่ 2',
      desc: 'จุดคลิกสูงรองจาก sidebar — เหมาะสำหรับการ์ดสินค้า/บริการแนะนำ',
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
    var href = (ad.href || '').trim();
    var rel = 'rel="sponsored nofollow noopener"';
    var target = 'target="_blank"';
    var isPlaceholder = !href;
    var cls = isPlaceholder ? 'aff-card aff-card--placeholder' : 'aff-card';
    var linkAttr = isPlaceholder ? '' : ('href="' + href + '" ' + rel + ' ' + target);
    var image = '';
    if (ad.image) {
      image = '<img src="' + ad.image + '" alt="' + esc(ad.title) + '" class="aff-card__img" loading="lazy">';
    }
    return (
      '<div class="' + cls + '">' +
        (isPlaceholder ? '' : '<a ' + linkAttr + ' class="aff-card__link">') +
          (ad.badge ? '<span class="aff-card__badge">' + esc(ad.badge) + '</span>' : '') +
          image +
          '<div class="aff-card__body">' +
            '<div class="aff-card__title">' + esc(ad.title) + '</div>' +
            '<div class="aff-card__desc">' + esc(ad.desc) + '</div>' +
            (ad.cta ? '<div class="aff-card__cta">' + esc(ad.cta) + ' →</div>' : '') +
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

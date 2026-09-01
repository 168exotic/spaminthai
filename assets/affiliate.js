/**
 * SpamInThai — Affiliate Ad Placement
 * =====================================
 * ส่วนกลางการจัดการโฆษณา Affiliate ของเว็บ spaminthai.com
 *
 * วิธีใช้:
 *   1. เพิ่ม slot ใน HTML:  <div class="affiliate-slot" data-slot="sidebar-top"></div>
 *   2. ลงทะเบียนรายการโฆษณาใน AD_CONFIG (ใส่ href = ลิงก์ affiliate จริง)
 *
 * กติกา (สำคัญ):
 *   - โฆษณาจะแสดงเมื่อมี href จริงเท่านั้น หาก href ว่าง กล่องจะไม่ถูกแสดง
 *     (ไม่เกิดกล่องว่าง/พังบนหน้าเว็บ) — พอใส่ลิงก์เมื่อไหร่ค่อยขึ้นเอง
 *   - ทุกลิงก์ได้ rel="sponsored nofollow noopener" อัตโนมัติ ตามหลัก SEO
 *   - โฆษณากำกับด้วยป้าย "Sponsored / โฆษณา" เสมอ (โปร่งใส, ถูกนโยบาย AdSense)
 */
(function () {
  // ============ CONFIG: ใส่ / แก้โฆษณาได้ตรงนี้เท่านั้น ============
  const AD_CONFIG = [
    // slot: sidebar-top (คอลัมน์ขวา บนสุด ในกล่องคำแนะนำ)
    {
      slot: 'sidebar-top',
      enabled: true,
      href: '',           // ← ใส่ลิงก์ affiliate จริง เช่น 'https://...?ref=xxx'
      image: '',          // ← ใส่ URL รูปแบนเนอร์ถ้ามี (ถ้าไม่มี ให้ '' = การ์ดข้อความล้วน)
      badge: 'Sponsored',
      title: 'ผลิตภัณฑ์แนะนำ',
      desc: 'รายละเอียดสินค้า/บริการที่จะแนะนำที่นี่',
      cta: 'ดูรายละเอียด',
    },
    // slot: below-result (ใต้กล่องผลตรวจเบอร์)
    {
      slot: 'below-result',
      enabled: true,
      href: '',
      image: '',
      badge: 'Sponsored',
      title: 'บริการแนะนำ',
      desc: 'รายละเอียดบริการที่จะแนะนำที่นี่',
      cta: 'คลิกที่นี่',
    },
  ];
  // ============ END CONFIG ============

  function inject() {
    const slots = document.querySelectorAll('.affiliate-slot');
    if (!slots.length) return;
    AD_CONFIG.forEach(function (ad) {
      if (!ad || !ad.enabled) return;
      // แสดงเฉพาะโฆษณาที่มี href จริง — ถ้ายังไม่มี ให้ข้าม (slot ยังว่าง, ไม่พัง)
      if (!ad.href || !String(ad.href).trim()) return;
      var slot = document.querySelector('.affiliate-slot[data-slot="' + ad.slot + '"]');
      if (!slot) return;
      slot.innerHTML = renderAd(ad);
    });
  }

  function renderAd(ad) {
    var href = String(ad.href).trim();
    var rel = 'rel="sponsored nofollow noopener"';
    var target = 'target="_blank"';
    var image = '';
    if (ad.image) {
      image = '<img src="' + esc(ad.image) + '" alt="' + esc(ad.title) + '" class="aff-card__img" loading="lazy">';
    }
    return (
      '<div class="aff-card">' +
        '<a href="' + href + '" ' + rel + ' ' + target + ' class="aff-card__link">' +
          (ad.badge ? '<span class="aff-card__badge">' + esc(ad.badge) + '</span>' : '') +
          image +
          '<div class="aff-card__body">' +
            '<div class="aff-card__title">' + esc(ad.title) + '</div>' +
            '<div class="aff-card__desc">' + esc(ad.desc) + '</div>' +
            (ad.cta ? '<div class="aff-card__cta">' + esc(ad.cta) + ' →</div>' : '') +
          '</div>' +
        '</a>' +
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

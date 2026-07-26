// Viral share helpers — LINE, Facebook, copy link (with UTM for attribution).
(function () {
  const SITE = 'https://spaminthai.com';

  function fmtPhone(n) {
    const d = String(n || '').replace(/\D/g, '');
    if (d.length >= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length >= 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return d;
  }

  function buildUrl(path, params) {
    const u = new URL(path.startsWith('http') ? path : SITE + path);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') u.searchParams.set(k, v);
    });
    return u.toString();
  }

  function shareUrl(opts) {
    const { number, source = 'web', medium = 'share', campaign = 'viral' } = opts || {};
    const path = number ? `/check/${String(number).replace(/\D/g, '')}` : '/check';
    return buildUrl(path, {
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
    });
  }

  function shareText(opts) {
    const { number, label, verdict } = opts || {};
    const display = number ? fmtPhone(number) : '';
    if (number && label) {
      const warn =
        verdict === 'danger'
          ? '⚠️ เบอร์อันตราย!'
          : verdict === 'caution'
            ? '⚠️ เบอร์น่าสงสัย'
            : '';
      return `${warn} เบอร์ ${display} — ${label}\nเช็คเบอร์มิจฉาชีพฟรีที่ SpamInThai 👇`;
    }
    return 'เช็คเบอร์มิจฉาชีพ แก๊งคอลเซ็นเตอร์ ฟรี — ก่อนรับสายหรือโอนเงิน 👇';
  }

  function lineShare(url, text) {
    const msg = `${text}\n${url}`;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  function facebookShare(url) {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=600,height=500'
    );
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  function nativeShare(url, text) {
    if (!navigator.share) return false;
    navigator.share({ title: 'SpamInThai', text, url }).catch(() => {});
    return true;
  }

  function trackShare(channel) {
    try {
      const vid = localStorage.getItem('spaminthai_vid') || `w${Date.now().toString(36)}`;
      localStorage.setItem('spaminthai_vid', vid);
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'pageview', source: 'web', vid }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    if (typeof gtag === 'function') {
      gtag('event', 'share', { method: channel, content_type: 'phone_check' });
    }
  }

  function share(channel, opts) {
    const url = shareUrl(opts);
    const text = shareText(opts);
    trackShare(channel);
    if (channel === 'line') return lineShare(url, text);
    if (channel === 'facebook') return facebookShare(url);
    if (channel === 'native' && nativeShare(url, text)) return true;
    if (channel === 'copy') {
      copyLink(`${text}\n${url}`).then((ok) => {
        const el = document.querySelector('[data-share-toast]');
        if (el) {
          el.textContent = ok ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกไม่สำเร็จ';
          el.hidden = false;
          setTimeout(() => {
            el.hidden = true;
          }, 2500);
        } else if (ok) {
          alert('คัดลอกลิงก์แล้ว — แชร์ในกลุ่ม LINE/FB ได้เลย');
        }
      });
      return true;
    }
    return false;
  }

  function injectShareBar(container, opts) {
    if (!container || container.querySelector('.share-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'share-bar';
    bar.innerHTML = `
<p class="share-label">แชร์เตือนคนอื่น (ฟรี ช่วยกันหลบมิจฉาชีพ)</p>
<div class="share-btns">
  <button type="button" class="share-btn share-line" data-share="line" aria-label="แชร์ LINE">LINE</button>
  <button type="button" class="share-btn share-fb" data-share="facebook" aria-label="แชร์ Facebook">Facebook</button>
  <button type="button" class="share-btn share-copy" data-share="copy" aria-label="คัดลอกลิงก์">คัดลอก</button>
</div>
<p class="share-toast" data-share-toast hidden>คัดลอกลิงก์แล้ว ✓</p>`;

    if (!document.getElementById('shareBarStyles')) {
      const style = document.createElement('style');
      style.id = 'shareBarStyles';
      style.textContent = `
.share-bar{margin-top:16px;padding-top:14px;border-top:1px dashed rgba(0,0,0,.08)}
.share-label{font-size:.78rem;color:#64748b;margin:0 0 8px;font-weight:600}
.share-btns{display:flex;flex-wrap:wrap;gap:8px}
.share-btn{border:none;border-radius:99px;padding:8px 14px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s}
.share-btn:hover{opacity:.88}
.share-line{background:#06C755;color:#fff}
.share-fb{background:#1877F2;color:#fff}
.share-copy{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0}
.share-toast{font-size:.75rem;color:#059669;margin:8px 0 0;font-weight:600}`;
      document.head.appendChild(style);
    }

    container.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-share]');
      if (!btn) return;
      share(btn.dataset.share, opts);
    });
  }

  window.SpamShare = { share, shareUrl, shareText, injectShareBar, fmtPhone };
})();

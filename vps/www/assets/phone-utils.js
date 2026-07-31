// Shared Thai phone validation for static pages (mirrors functions/api/carrier.js).
(function (global) {
  function normalizeThaiNumber(number) {
    let digits = String(number || '').replace(/\D/g, '');
    if (digits.startsWith('66') && digits.length >= 11) digits = '0' + digits.slice(2);
    if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;
    return digits;
  }

  function isValidThaiPhone(number) {
    const digits = normalizeThaiNumber(number);
    if (!digits.startsWith('0') || !/^\d+$/.test(digits)) return false;

    const prefix2 = digits.slice(0, 2);
    if (prefix2 === '06' || prefix2 === '08' || prefix2 === '09') {
      return digits.length === 10;
    }
    if (prefix2 === '02' || /^0[3-57]/.test(digits)) {
      return digits.length === 9;
    }
    return false;
  }

  global.SpamPhone = { normalizeThaiNumber, isValidThaiPhone };
})(typeof window !== 'undefined' ? window : globalThis);

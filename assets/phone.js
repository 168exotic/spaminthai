/**
 * Shared Thai local phone helpers for static HTML pages.
 * Keep in sync with functions/api/phone.js
 *
 * Mobile 06/08/09 = 10 digits; landline 02–05/07 = 9 digits.
 */
(function (global) {
  function normalizePhone(raw) {
    var n = String(raw || '').replace(/\D/g, '');
    if (n.indexOf('66') === 0) {
      var rest = n.slice(2);
      if (rest.length === 8 || rest.length === 9) n = '0' + rest;
    }
    return n;
  }

  function isThaiLocalPhone(raw) {
    var n = String(raw || '');
    return /^0[689]\d{8}$/.test(n) || /^0[2-57]\d{7}$/.test(n);
  }

  global.SpamPhone = { normalizePhone: normalizePhone, isThaiLocalPhone: isThaiLocalPhone };
})(typeof window !== 'undefined' ? window : globalThis);

// Thai local phone normalization + validation.
//
// Mobile (06 / 08 / 09): always 10 digits.
// Landline (02–05 / 07): always 9 digits.
// Incomplete mobiles like 081234567 must NOT be accepted as landlines.

/** Strip non-digits and convert +66 / 66 country code to leading 0 when complete. */
export function normalizePhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('66')) {
    const rest = n.slice(2);
    // 66 + 9 national digits (mobile) or 66 + 8 (landline)
    if (rest.length === 8 || rest.length === 9) n = '0' + rest;
  }
  return n;
}

/**
 * True only for a complete Thai local number:
 * - mobile: 0[689] + 8 digits (10 total)
 * - landline: 0[2-57] + 7 digits (9 total)
 */
export function isThaiLocalPhone(raw) {
  const n = String(raw || '');
  return /^0[689]\d{8}$/.test(n) || /^0[2-57]\d{7}$/.test(n);
}

/** Normalize then validate — returns digits or null. */
export function parseThaiLocalPhone(raw) {
  const n = normalizePhone(raw);
  return isThaiLocalPhone(n) ? n : null;
}

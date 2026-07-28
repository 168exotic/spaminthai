// Unit tests for Thai local phone normalize + validation (functions/api/phone.js)
// Run with: npm test
import { normalizePhone, isThaiLocalPhone, parseThaiLocalPhone } from '../functions/api/phone.js';

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  - ${name}`);
  } else {
    failed++;
    console.error(`FAIL  - ${name}${detail ? '  (' + detail + ')' : ''}`);
  }
}

// --- valid mobiles (10 digits, 06/08/09) ---
check('mobile 081 ok', isThaiLocalPhone('0812345678') === true);
check('mobile 061 ok', isThaiLocalPhone('0612345678') === true);
check('mobile 091 ok', isThaiLocalPhone('0912345678') === true);
check('mobile 0655081234 ok', isThaiLocalPhone('0655081234') === true);

// --- valid landlines (9 digits, 02–05/07) ---
check('landline 02 ok', isThaiLocalPhone('021234567') === true);
check('landline 03 ok', isThaiLocalPhone('032123456') === true);
check('landline 07 ok', isThaiLocalPhone('074123456') === true);

// --- incomplete mobiles MUST be rejected (the bug) ---
check('incomplete 081234567 rejected', isThaiLocalPhone('081234567') === false);
check('incomplete 061234567 rejected', isThaiLocalPhone('061234567') === false);
check('incomplete 091234567 rejected', isThaiLocalPhone('091234567') === false);

// --- truncated E.164 / country-code junk ---
check('truncated 6681234567 rejected', isThaiLocalPhone('6681234567') === false);
check('incomplete 66 mobile 6661234567 -> normalize then reject', (() => {
  const n = normalizePhone('6661234567'); // -> 061234567
  return n === '061234567' && isThaiLocalPhone(n) === false;
})());

// --- normalize complete +66 ---
check('+66 mobile normalizes', normalizePhone('+66812345678') === '0812345678');
check('66 landline normalizes', normalizePhone('6621234567') === '021234567');
check('parseThaiLocal +66 mobile', parseThaiLocalPhone('+66812345678') === '0812345678');
check('parseThaiLocal incomplete null', parseThaiLocalPhone('081234567') === null);

// --- old buggy regex would accept these; we must not ---
check('old /^0\\d{8,9}$/ false positive blocked', isThaiLocalPhone('081234567') === false);
check('10-digit landline-shaped rejected', isThaiLocalPhone('0212345678') === false);
check('9-digit mobile-shaped rejected', isThaiLocalPhone('081234567') === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

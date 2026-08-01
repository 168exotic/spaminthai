// Unit tests for Thai carrier lookup in functions/api/carrier.js
// Run with: npm test
import { identifyCarrier, isValidThaiPhone, normalizeThaiNumber } from '../functions/api/carrier.js';

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

check('normalize adds leading zero', normalizeThaiNumber('812345678') === '0812345678');
check('normalize strips +66', normalizeThaiNumber('66812345678') === '0812345678');
check('normalize rejects truncated +66 mobile', normalizeThaiNumber('6681234567') === '6681234567');

check('valid 10-digit mobile', isValidThaiPhone('0812345678') === true);
check('valid 9-digit landline', isValidThaiPhone('021234567') === true);
check('reject 9-digit mobile 08x', isValidThaiPhone('081234567') === false);
check('reject 9-digit mobile 06x', isValidThaiPhone('061234567') === false);
check('reject 9-digit mobile 09x', isValidThaiPhone('091234567') === false);
check('reject truncated E.164 mobile', isValidThaiPhone('6681234567') === false);
check('accept full E.164 mobile', isValidThaiPhone('66812345678') === true);
check('reject 8-digit landline', isValidThaiPhone('02123456') === false);

{
  const r = identifyCarrier('0812345678');
  check('081 is AIS', r.carrier === 'ais' && r.carrierLabel === 'AIS', JSON.stringify(r));
  check('081 is mobile', r.networkType === 'mobile', JSON.stringify(r));
}

{
  const r = identifyCarrier('0661234567');
  check('066 is DTAC', r.carrier === 'dtac' && r.carrierLabel === 'ดีแทค', JSON.stringify(r));
}

{
  const r = identifyCarrier('0951234567');
  check('095 is True', r.carrier === 'true' && r.carrierLabel === 'ทรู', JSON.stringify(r));
}

{
  const r = identifyCarrier('0801234567');
  check('080 is shared', r.carrier === 'shared' && r.carrierLabel === 'หลายค่าย', JSON.stringify(r));
}

{
  const r = identifyCarrier('021234567');
  check('02 is landline', r.carrier === 'landline' && r.networkType === 'landline', JSON.stringify(r));
}

{
  const r = identifyCarrier('032123456');
  check('03x is landline', r.carrier === 'landline', JSON.stringify(r));
}

{
  const r = identifyCarrier('123');
  check('too short returns null carrier', r.carrier === null, JSON.stringify(r));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

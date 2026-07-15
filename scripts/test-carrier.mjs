// Unit tests for Thai carrier lookup in functions/api/carrier.js
// Run with: npm test
import { identifyCarrier, normalizeThaiNumber } from '../functions/api/carrier.js';

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

// Unit tests for /api/lookup phone payload shape (carrier on not-found).
import { identifyCarrier } from '../functions/api/carrier.js';

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

// Phone not in DB should still expose carrier metadata for widgets.
{
  const value = '0899999999';
  const carrier = identifyCarrier(value);
  check('not-found phone has carrier label', !!carrier.carrierLabel, JSON.stringify(carrier));
  check('not-found phone is mobile', carrier.networkType === 'mobile', JSON.stringify(carrier));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

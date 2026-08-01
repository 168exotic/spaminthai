// Unit tests for functions/api/site-config.js
import { buildSiteConfig, parseGa4MeasurementId } from '../functions/api/site-config.js';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  - ${name}`);
  } else {
    failed++;
    console.error(`FAIL  - ${name}${detail ? `  (${detail})` : ''}`);
  }
}

check('parseGa4MeasurementId valid', parseGa4MeasurementId('G-ABC123XYZ') === 'G-ABC123XYZ');
check('parseGa4MeasurementId normalizes case', parseGa4MeasurementId('g-abc123xyz') === 'G-ABC123XYZ');
check('parseGa4MeasurementId rejects empty', parseGa4MeasurementId('') === null);
check('parseGa4MeasurementId rejects UA-', parseGa4MeasurementId('UA-12345-1') === null);

check(
  'buildSiteConfig without env',
  buildSiteConfig({}).ga4MeasurementId === null,
);
check(
  'buildSiteConfig with env',
  buildSiteConfig({ GA4_MEASUREMENT_ID: 'G-TEST1234' }).ga4MeasurementId === 'G-TEST1234',
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

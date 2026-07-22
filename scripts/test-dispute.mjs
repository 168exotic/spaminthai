// Unit tests for the dispute system (functions/api/dispute.js + dispute-utils.js)
// Run with: npm test
import { validateDispute } from '../functions/api/dispute.js';
import { ulid, disputeRef, ipHash } from '../functions/api/dispute-utils.js';

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

const base = {
  num: '0812345678',
  relationship: 'owner',
  reason: 'เบอร์นี้เป็นเบอร์ธุรกิจของร้านผม ถูกรายงานผิดพลาด ไม่ได้หลอกใคร',
  contact_channel: 'line',
};

// --- happy path ---
{
  const r = validateDispute(base);
  check('valid dispute passes', r.ok === true, JSON.stringify(r));
  check('valid dispute normalizes phone', r.ok && r.clean.num === '0812345678', JSON.stringify(r));
}

// --- phone ---
check('short number rejected', validateDispute({ ...base, num: '0812' }).error === 'invalid_number');
check('+66 number normalized+accepted', validateDispute({ ...base, num: '+66812345678' }).ok === true);
check('empty number rejected', validateDispute({ ...base, num: '' }).error === 'invalid_number');

// --- relationship ---
check('bad relationship rejected', validateDispute({ ...base, relationship: 'hacker' }).error === 'invalid_relationship');
check('missing relationship rejected', validateDispute({ ...base, relationship: '' }).error === 'invalid_relationship');
check('business relationship ok', validateDispute({ ...base, relationship: 'business' }).ok === true);

// --- reason length ---
check('short reason rejected', validateDispute({ ...base, reason: 'สั้นไป' }).error === 'reason_too_short');
check('reason exactly 30 chars ok', validateDispute({ ...base, reason: 'ก'.repeat(30) }).ok === true);
check('reason 29 chars rejected', validateDispute({ ...base, reason: 'ก'.repeat(29) }).error === 'reason_too_short');
check('reason over 2000 rejected', validateDispute({ ...base, reason: 'ก'.repeat(2001) }).error === 'reason_too_long');

// --- contact channel ---
check('bad channel rejected', validateDispute({ ...base, contact_channel: 'sms' }).error === 'invalid_contact_channel');
check('none channel ok', validateDispute({ ...base, contact_channel: 'none' }).ok === true);
check('email channel needs email', validateDispute({ ...base, contact_channel: 'email' }).error === 'email_required');
check('email channel bad email rejected', validateDispute({ ...base, contact_channel: 'email', contact_value: 'nope' }).error === 'invalid_email');
{
  const r = validateDispute({ ...base, contact_channel: 'email', contact_value: 'me@example.com' });
  check('email channel valid email ok', r.ok === true, JSON.stringify(r));
  check('email retained in clean', r.ok && r.clean.contact_value === 'me@example.com');
}
check('line channel drops stray email value', validateDispute({ ...base, contact_channel: 'none', contact_value: 'x@y.com' }).clean.contact_value === '');

// --- ULID + ref ---
{
  const id = ulid();
  check('ulid is 26 chars', id.length === 26, id);
  check('ulid is uppercase crockford', /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id), id);
  const a = ulid();
  const b = ulid();
  check('ulids are unique', a !== b, `${a} ${b}`);
  check('disputeRef format DSP-XXXXXX', /^DSP-[0-9A-Z]{6}$/.test(disputeRef(id)), disputeRef(id));
}

// --- ip hash (async, hex, stable, salted) ---
{
  const h1 = await ipHash('203.0.113.9', {});
  const h2 = await ipHash('203.0.113.9', {});
  const h3 = await ipHash('203.0.113.10', {});
  check('ip hash is 32 hex chars', /^[0-9a-f]{32}$/.test(h1), h1);
  check('ip hash is stable', h1 === h2);
  check('ip hash differs per ip', h1 !== h3);
  check('ip hash is not the raw ip', !h1.includes('203'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

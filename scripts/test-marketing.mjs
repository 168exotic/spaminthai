#!/usr/bin/env node
/** Unit tests for marketing automation (no live API). */

import {
  fmtPhone,
  hourSlotBangkok,
  buildNumberPost,
  buildAppPost,
  buildGuidePost,
  buildCheckPost,
  pickPostType,
  buildRssXml,
} from '../functions/api/marketing.js';

let passed = 0;
let failed = 0;

function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ok  - ${label}`);
    passed++;
  } else {
    console.error(`  FAIL - ${label}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

const mockItem = {
  number: '021365777',
  display: '021-365-777',
  label: 'เบอร์อันตราย',
  advice: 'มีรายงานจำนวนมาก',
  reports: 12,
  verdict: 'danger',
};

check('fmtPhone 10 digits', fmtPhone('021365777') === '021-365-777');
check('hourSlotBangkok format', /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(hourSlotBangkok(new Date('2026-07-26T10:30:00Z'))));
check('buildNumberPost has link', buildNumberPost(mockItem, 'slot1').includes('/check/021365777'));
check('buildNumberPost has utm', buildNumberPost(mockItem, 'slot1').includes('utm_campaign=auto_number'));
check('buildAppPost has download', buildAppPost('s').includes('/download'));
check('buildGuidePost has guide path', buildGuidePost('slot-guide').includes('/guide/'));
check('buildCheckPost has /check', buildCheckPost('s').includes('/check'));
check('pickPostType returns valid', ['number', 'app', 'guide', 'check'].includes(pickPostType('test-slot')));

const mockEnv = {
  SPAM_KV: {
    async get(key) {
      if (key === 'seo:top-numbers') {
        return JSON.stringify([{ number: '021365777', reports: 12 }]);
      }
      if (key === 'num:021365777') {
        return JSON.stringify({
          reports: 12,
          categories: { callcenter: 10, scam: 2 },
          lastReport: new Date().toISOString(),
        });
      }
      return null;
    },
    async list() { return { keys: [], list_complete: true }; },
  },
};

const rss = await buildRssXml(mockEnv);
check('RSS has channel', rss.includes('<channel>'));
check('RSS has item', rss.includes('<item>'));
check('RSS has check URL', rss.includes('/check/021365777'));
check('RSS escapes ampersand in XML', !rss.includes('&amp;amp;'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

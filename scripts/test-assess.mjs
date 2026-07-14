// Unit tests for the risk-scoring logic in functions/api/lookup.js
// Run with: npm test
import { assess } from '../functions/api/lookup.js';

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

// 1. No reports -> unknown, score 0
{
  const r = assess({ reports: 0, categories: {}, lastReport: null });
  check('empty number is unknown', r.verdict === 'unknown', JSON.stringify(r));
  check('empty number score is 0', r.score === 0, JSON.stringify(r));
}

// 2. A single scam report -> caution
{
  const r = assess({ reports: 1, categories: { scam: 1 }, lastReport: Date.now() });
  check('single scam report is caution', r.verdict === 'caution', JSON.stringify(r));
  check('single scam report has score > 0', r.score > 0, JSON.stringify(r));
  check('single scam report topCategory scam', r.topCategory === 'scam', JSON.stringify(r));
}

// 3. Heavy scam/callcenter -> danger, high score
{
  const r = assess({ reports: 8, categories: { scam: 5, callcenter: 3 }, lastReport: Date.now() });
  check('heavy reports is danger', r.verdict === 'danger', JSON.stringify(r));
  check('heavy reports score is 100 (clamped)', r.score === 100, JSON.stringify(r));
}

// 4. Danger by count even if categories are lighter (badVotes >= 5)
{
  const r = assess({ reports: 6, categories: { ads: 6 }, lastReport: Date.now() });
  check('6 ads reports -> danger via badVotes rule', r.verdict === 'danger', JSON.stringify(r));
}

// 5. Only safe votes -> safe, score 0
{
  const r = assess({ reports: 4, categories: { safe: 4 }, lastReport: Date.now() });
  check('only safe votes -> safe verdict', r.verdict === 'safe', JSON.stringify(r));
  check('only safe votes -> score 0', r.score === 0, JSON.stringify(r));
}

// 6. Safe votes pull the score down but bad votes still dominate
{
  const r = assess({ reports: 5, categories: { scam: 3, safe: 2 }, lastReport: Date.now() });
  check('mixed votes stays flagged (caution/danger)', r.verdict === 'danger' || r.verdict === 'caution', JSON.stringify(r));
}

// 7. Score is always clamped to 0..100
{
  const r = assess({ reports: 100, categories: { scam: 100 }, lastReport: Date.now() });
  check('score never exceeds 100', r.score <= 100 && r.score >= 0, JSON.stringify(r));
}

// 8. Robust against malformed input
{
  const r = assess({});
  check('missing fields default to unknown', r.verdict === 'unknown', JSON.stringify(r));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
// Prepares the weekly SpamInThai release:
//   - bumps the minor version (1.1.0 -> 1.2.0)
//   - syncs the version + release date into package.json, functions/api/version.js,
//     and _worker.js (the production Worker entrypoint that actually serves /api/version)
//   - prepends a dated stub section to CHANGELOG.md
//
// Run manually with `npm run release:weekly`, or automatically every Tuesday via
// .github/workflows/weekly-release.yml. Pass --dry-run to preview without writing,
// or --date=YYYY-MM-DD to override the release date.
//
// The actual product improvement for the week is filled into the CHANGELOG stub
// and implemented by the maintainer (or a Cursor scheduled agent) before merge.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dateArg = (args.find((a) => a.startsWith('--date=')) || '').split('=')[1];

function upcomingTuesday(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun ... 2=Tue
  const delta = (2 - day + 7) % 7; // 0 if today is Tuesday
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function bumpMinor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Cannot parse version "${version}"`);
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

const releaseDate = dateArg || upcomingTuesday();

// --- package.json ---
const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = bumpMinor(oldVersion);
pkg.version = newVersion;

// --- functions/api/version.js ---
const verPath = join(ROOT, 'functions/api/version.js');
let verSrc = readFileSync(verPath, 'utf8');
verSrc = verSrc
  .replace(/const WEB_VERSION = '[^']*';/, `const WEB_VERSION = '${newVersion}';`)
  .replace(/const RELEASED_AT = '[^']*';/, `const RELEASED_AT = '${releaseDate}';`);

// --- _worker.js ---
// The production Cloudflare Worker (advanced mode) inlines its own WEB_VERSION /
// RELEASED_AT and serves /api/version from them; functions/api/version.js is not
// used at runtime. Keep this file in sync so the deployed version label matches.
const workerPath = join(ROOT, '_worker.js');
let workerSrc = readFileSync(workerPath, 'utf8');
workerSrc = workerSrc
  .replace(/const WEB_VERSION = '[^']*';/, `const WEB_VERSION = '${newVersion}';`)
  .replace(/const RELEASED_AT = '[^']*';/, `const RELEASED_AT = '${releaseDate}';`);

// --- CHANGELOG.md ---
const clPath = join(ROOT, 'CHANGELOG.md');
const cl = readFileSync(clPath, 'utf8');
const stub =
  `## [${newVersion}] — ${releaseDate}\n\n` +
  `> **TODO:** describe this week's improvement — it must make SpamInThai\n` +
  `> better than v${oldVersion} (new feature, stronger detection, better UX/a11y,\n` +
  `> or a meaningful fix). Remove this note before merging.\n\n` +
  `### Added\n-\n\n### Changed\n-\n\n### Fixed\n-\n`;

const anchor = cl.indexOf('\n## [');
if (anchor === -1) throw new Error('Could not find an existing "## [" release heading in CHANGELOG.md');
const newCl = cl.slice(0, anchor + 1) + stub + '\n' + cl.slice(anchor + 1);

console.log(`Weekly release: ${oldVersion} -> ${newVersion} (target ${releaseDate})`);

if (DRY_RUN) {
  console.log('\n[--dry-run] No files written. CHANGELOG stub preview:\n');
  console.log(stub);
} else {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(verPath, verSrc);
  writeFileSync(workerPath, workerSrc);
  writeFileSync(clPath, newCl);
  console.log('Updated package.json, functions/api/version.js, _worker.js, CHANGELOG.md');
}

// Expose values for the CI workflow.
if (process.env.GITHUB_OUTPUT) {
  const out = `old_version=${oldVersion}\nnew_version=${newVersion}\nrelease_date=${releaseDate}\n`;
  writeFileSync(process.env.GITHUB_OUTPUT, out, { flag: 'a' });
}

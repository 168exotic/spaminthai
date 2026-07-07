#!/usr/bin/env node
/**
 * Verify a Cloudflare API token can read the SPAM_KV namespace.
 * Run before seed-spam-numbers.js to catch broken-lab-style policy mistakes.
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '2fa3f2f325707bab89ef1c7452d3adb8';
const NAMESPACE_ID = process.env.KV_NAMESPACE_ID || 'd1417790ca5841bebf80cbc25443e070';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN to your API token secret.');
  process.exit(1);
}

async function cf(path, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const body = await res.json();
  return { res, body };
}

function explain(errors = [], status = 0) {
  const text = errors.map((e) => e.message).join(' ').toLowerCase();
  if (text.includes('authentication') || text.includes('invalid api token')) {
    return 'Token secret is invalid or expired.';
  }
  if (text.includes('permission') || text.includes('unauthorized') || status === 403) {
    return [
      'Token lacks account-scoped Workers KV Storage permissions.',
      'See docs/TOKEN-POLICY.md — zone-scoped tokens (broken-lab-8596) cannot access KV API.'
    ].join(' ');
  }
  return errors.map((e) => e.message).join('; ') || 'Unknown Cloudflare API error.';
}

async function main() {
  console.log('Checking token against account', ACCOUNT_ID);
  console.log('KV namespace', NAMESPACE_ID);

  const { res, body } = await cf(
    `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/keys?limit=1`
  );

  if (!body.success) {
    console.error('\nToken check failed.');
    console.error(explain(body.errors, res.status));
    if (body.errors?.length) {
      console.error('\nAPI errors:', JSON.stringify(body.errors, null, 2));
    }
    process.exit(1);
  }

  console.log('\nOK — token can read KV namespace. Safe to run seed-spam-numbers.js.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

// GET /api/site-config — public site settings (analytics IDs, etc.)
import { json } from './tip-utils.js';

export function parseGa4MeasurementId(raw) {
  const id = String(raw || '').trim();
  if (!/^G-[A-Z0-9]+$/i.test(id)) return null;
  return id.toUpperCase();
}

export function buildSiteConfig(env) {
  return {
    ga4MeasurementId: parseGa4MeasurementId(env?.GA4_MEASUREMENT_ID),
  };
}

export async function onRequestGet({ env }) {
  return json(buildSiteConfig(env), 200, { 'Cache-Control': 'public, max-age=300' });
}

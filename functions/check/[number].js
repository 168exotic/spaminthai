import { renderNumberPage } from './render-number-page.js';

export async function onRequestGet({ params, env }) {
  return renderNumberPage(params.number, env);
}

// Build-time Tailwind (replaces the runtime https://cdn.tailwindcss.com script).
// Rebuild after changing classes: npm run build:css  -> assets/tailwind.css (committed; Pages has no build step).
// Pinned to tailwindcss 3.4.17 = the version cdn.tailwindcss.com served when this was migrated.
// No inline tailwind.config customizations existed on the CDN pages, so the default theme is used.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './{admin,blog,guide,news}/**/*.html',
    './assets/**/*.js',
    './functions/**/*.js',
    './_worker.js',
  ],
  theme: { extend: {} },
  plugins: [],
};

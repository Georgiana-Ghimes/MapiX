/** Semver + build injectate de Vite din package.json. */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? Number(__APP_BUILD__) : 0;

export function formatAppVersion({ compact = false } = {}) {
  if (compact) return `v${APP_VERSION} · ${APP_BUILD}`;
  return `v${APP_VERSION} · build ${APP_BUILD}`;
}

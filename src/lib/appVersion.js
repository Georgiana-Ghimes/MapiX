import pkg from '../../package.json';

/** Semver + build din package.json (se actualizează la HMR / restart Vite). */
export const APP_VERSION = pkg.version || '0.0.0';
export const APP_BUILD = Number(pkg.build) || 0;

export function formatAppVersion({ compact = false } = {}) {
  if (compact) return `v${APP_VERSION} · ${APP_BUILD}`;
  return `v${APP_VERSION} · build ${APP_BUILD}`;
}

// Sends crashes to VITE_ERROR_URL (any webhook that accepts a POST, e.g. a chat or form-to-email service). Off when unset.
const URL = import.meta.env.VITE_ERROR_URL;
let sent = 0;

export function report(error, where = window.location.pathname) {
  if (/ResizeObserver loop|extension:\/\//.test(String(error?.message ?? error))) return; // browser and extension noise must not use up the five
  if (!URL || sent >= 5) return; // five per page load: a render loop must not flood the inbox
  sent++;
  const body = JSON.stringify({ at: new Date().toISOString(), where, message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 1500), agent: navigator.userAgent });
  try { navigator.sendBeacon(URL, new Blob([body], { type: 'text/plain' })); } catch { /* reporting must never throw */ }
}

export function watchErrors() {
  window.addEventListener('error', (e) => report(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => report(e.reason));
}

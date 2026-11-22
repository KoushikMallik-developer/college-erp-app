// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('does nothing without an address, and sends at most five reports when one is set', async () => {
  const beacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

  let { report } = await import('../src/lib/report.js');
  report(new Error('x'));
  expect(beacon).not.toHaveBeenCalled();

  vi.resetModules();
  vi.stubEnv('VITE_ERROR_URL', 'https://example.test/hook');
  ({ report } = await import('../src/lib/report.js'));
  for (let i = 0; i < 8; i++) report(new Error(`boom ${i}`));
  expect(beacon).toHaveBeenCalledTimes(5);
  expect(beacon.mock.calls[0][0]).toBe('https://example.test/hook');
});

it('ignores browser noise so it cannot use up the five', async () => {
  const beacon = vi.fn(() => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  vi.stubEnv('VITE_ERROR_URL', 'https://example.test/hook');
  const { report } = await import('../src/lib/report.js');
  for (let i = 0; i < 6; i++) report('ResizeObserver loop completed with undelivered notifications.');
  report(new Error('real crash'));
  expect(beacon).toHaveBeenCalledTimes(1);
});

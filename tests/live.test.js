import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// A stand-in for the Firestore library: it records which paths are written.
vi.mock('@firebase/firestore', () => {
  const ok = vi.fn(async () => undefined);
  return {
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    serverTimestamp: () => 'now',
    setDoc: ok, addDoc: ok, updateDoc: ok, deleteDoc: ok,
    writeBatch: () => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => undefined) }),
  };
});
const raw = await import('@firebase/firestore');
const live = await import('../src/lib/firestore-live.js');

const touches = () => raw.setDoc.mock.calls.filter(([ref]) => ref.path === 'institutions/c1/meta/live').length;
const student = { path: 'institutions/c1/students/s1' };
const readState = { path: 'institutions/c1/readState/u1' };

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); live.setLiveTarget({ db: {}, iid: 'c1', uid: 'u1' }); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); live.setLiveTarget(null); });

it('a write touches the signal once, after a second, however many writes came', async () => {
  await live.setDoc(student, {});
  await live.updateDoc(student, {});
  expect(touches()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(touches()).toBe(1);
});

it('marking a notification read does not wake anyone', async () => {
  await live.setDoc(readState, {});
  await vi.advanceTimersByTimeAsync(2000);
  expect(touches()).toBe(0);
});

it('a batch touches only if it changed something besides read marks', async () => {
  const onlyRead = live.writeBatch({});
  onlyRead.set(readState, {});
  await onlyRead.commit();
  await vi.advanceTimersByTimeAsync(2000);
  expect(touches()).toBe(0);

  const real = live.writeBatch({});
  real.set(readState, {});
  real.update(student, {});
  await real.commit();
  await vi.advanceTimersByTimeAsync(2000);
  expect(touches()).toBe(1);
});

it('no signed-in college user, no touch', async () => {
  live.setLiveTarget(null);
  await live.setDoc(student, {});
  await vi.advanceTimersByTimeAsync(2000);
  expect(touches()).toBe(0);
});

// Stands in for 'firebase/firestore' (see the alias in vite.config.js). Everything is re-exported unchanged except the
// write functions: after a successful write to college data they also touch one small "something changed" document,
// which every signed-in user listens to (src/app/LiveProvider.jsx). That is how pages stay current without reloading.
import { doc, serverTimestamp, setDoc as rawSet, addDoc as rawAdd, updateDoc as rawUpdate, deleteDoc as rawDelete, writeBatch as rawBatch } from '@firebase/firestore';
export * from '@firebase/firestore';

let target = null; // { db, iid, uid } of the signed-in college user; null for platform admins and signed-out visitors
let timer = 0;
export const setLiveTarget = (t) => { target = t; };

// Several writes in a row make one touch. The rules allow one touch per 10 seconds, so a touch refused because someone
// else just touched it is retried once after the gap.
const bump = () => {
  if (!target) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const t = target;
    if (!t) return;
    const touch = () => rawSet(doc(t.db, 'institutions', t.iid, 'meta', 'live'), { at: serverTimestamp(), by: t.uid });
    touch().catch(() => setTimeout(() => touch().catch(() => {}), 10500));
  }, 1000);
};
// Marking a notification as read changes nothing anyone else should refresh for.
const quiet = (ref) => /\/readState\//.test(ref?.path ?? '');
const after = (ref, result) => { if (!quiet(ref)) bump(); return result; };

export const setDoc = async (ref, ...a) => after(ref, await rawSet(ref, ...a));
export const addDoc = async (ref, ...a) => after(ref, await rawAdd(ref, ...a));
export const updateDoc = async (ref, ...a) => after(ref, await rawUpdate(ref, ...a));
export const deleteDoc = async (ref, ...a) => after(ref, await rawDelete(ref, ...a));
export function writeBatch(db) {
  const batch = rawBatch(db);
  let dirty = false;
  for (const m of ['set', 'update', 'delete']) {
    const f = batch[m].bind(batch);
    batch[m] = (ref, ...a) => { if (!quiet(ref)) dirty = true; return f(ref, ...a); };
  }
  const commit = batch.commit.bind(batch);
  batch.commit = async () => { await commit(); if (dirty) bump(); };
  return batch;
}

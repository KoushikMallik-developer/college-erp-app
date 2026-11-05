import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tdoc } from '../lib/tenant';
import { setLiveTarget } from '../lib/firestore-live';
import { LiveCtx } from '../lib/liveContext';
import { ROLES } from '../lib/tenant';
import { useCtx } from './AuthProvider';

// One listener on one tiny document: 1 read per change per signed-in user. The first snapshot only sets the baseline.
export default function LiveProvider({ children }) {
  const { iid, uid, role } = useCtx();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!iid || role === ROLES.PLATFORM_ADMIN) return undefined;
    setLiveTarget({ db, iid, uid });
    let seen = false, pending = false, last = 0, wait = 0;
    // Refresh at most every 30 s, and only while the tab is open in front: busy colleges would burn the free read quota.
    const schedule = () => {
      clearTimeout(wait);
      if (!pending || document.visibilityState !== 'visible') return;
      wait = setTimeout(() => { pending = false; last = Date.now(); setVersion((v) => v + 1); }, Math.max(800, last + 30000 - Date.now()));
    };
    const stop = onSnapshot(tdoc(iid, 'meta', 'live'), () => {
      if (!seen) { seen = true; return; }
      pending = true;
      schedule();
    }, () => {}); // not allowed or offline: pages simply stay as they are until opened again
    document.addEventListener('visibilitychange', schedule);
    return () => { stop(); clearTimeout(wait); document.removeEventListener('visibilitychange', schedule); setLiveTarget(null); };
  }, [iid, uid, role]);
  return <LiveCtx.Provider value={version}>{children}</LiveCtx.Provider>;
}

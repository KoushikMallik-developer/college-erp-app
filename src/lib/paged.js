import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from './liveContext';
import { getDocs, limit, query, startAfter } from 'firebase/firestore';

export const PAGE = 25;

// Cursor pagination. build() returns the base query (filters + stable ordering).
export function usePaged(build, deps) {
  const [state, setState] = useState({ rows: [], last: null, more: false, loading: true, error: null });

  const latest = useRef(0); // only the newest first-page request may replace what is on screen
  const fetchPage = useCallback(async (after) => {
    const base = build();
    const snap = await getDocs(after ? query(base, startAfter(after), limit(PAGE)) : query(base, limit(PAGE)));
    return { rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })), last: snap.docs.at(-1) ?? null, more: snap.size === PAGE };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const first = useCallback(() => {
    const n = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchPage(null).then(
      (p) => n === latest.current && setState({ ...p, loading: false, error: null }),
      (error) => n === latest.current && setState({ rows: [], last: null, more: false, loading: false, error }),
    );
  }, [fetchPage]);

  useEffect(first, [first]);

  const live = useLive();
  const count = useRef(0);
  count.current = state.rows.length;
  useEffect(() => {
    if (!live || count.current > PAGE) return;
    const n = ++latest.current;
    // Skip if the user loaded more pages (or changed the list) while this was running.
    fetchPage(null).then((p) => n === latest.current && count.current <= PAGE && setState({ ...p, loading: false, error: null }), () => {});
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const p = await fetchPage(state.last);
    setState((s) => ({ ...s, rows: [...s.rows, ...p.rows], last: p.last ?? s.last, more: p.more }));
  };
  return { ...state, reload: first, loadMore };
}

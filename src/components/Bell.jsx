import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell as BellGlyph } from 'lucide-react';
import { useLive } from '../lib/liveContext';
import { Timestamp, getCountFromServer, getDoc, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useCtx } from '../app/AuthProvider';
import { tcol, tdoc, isAdminRole, ROLES } from '../lib/tenant';
import { list } from '../lib/data';
import { stash } from '../lib/stash';
import { Button, Modal, iconBtn, linkList } from './ui';

const WEEK = 7 * 24 * 3600 * 1000;
const count = async (q) => (await getCountFromServer(q)).data().count;
const sum = (list) => list.reduce((n, x) => n + x.n, 0);

// A short two-note chime made with the browser's audio, so there is no sound file to ship. Browsers refuse to play
// before the person has clicked or typed on the page once; then it stays silent instead of throwing.
let audio;
export function chime() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    [[880, 0], [1318.5, 0.14]].forEach(([freq, at]) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), t0 = audio.currentTime + at;
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0); osc.stop(t0 + 0.5);
    });
  } catch { /* no audio available */ }
}
export const soundOn = () => { try { return localStorage.getItem('bellSound') !== 'off'; } catch { return true; } };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// What is new since this user last looked. A few cheap reads on load and when the bell opens, never a listener.
async function loadNotices({ iid, uid, role, profile }) {
  const seen = (await getDoc(tdoc(iid, 'readState', uid))).data() ?? {};
  // A first-time user sees the last week as new, not the whole history.
  const since = (key) => seen[key]?.toDate?.() ?? new Date(Date.now() - WEEK);
  const admin = isAdminRole(role);
  const items = [];

  const recent = await list(query(tcol(iid, 'announcements'), where('status', '==', 'PUBLISHED'), orderBy('publishedAt', 'desc'), limit(3)));
  const fresh = recent.filter((a) => a.publishedAt?.toDate() > since('announcementsSeenAt')
    && (admin || !a.audienceRoles?.length || a.audienceRoles.includes(role)));
  if (fresh.length) items.push({ key: 'announcementsSeenAt', to: '/announcements', n: fresh.length, text: `${plural(fresh.length, 'new announcement', 'new announcements')}${fresh.length === 3 ? ' or more' : ''}` });

  const events = await count(query(tcol(iid, 'calendarEvents'), where('createdAt', '>', Timestamp.fromDate(since('eventsSeenAt')))));
  if (events) items.push({ key: 'eventsSeenAt', to: '/calendar', n: events, text: plural(events, 'new calendar event', 'new calendar events') });

  if (admin) {
    const pending = await count(query(tcol(iid, 'requests'), where('status', '==', 'PENDING')));
    if (pending) items.push({ to: '/requests', n: pending, text: plural(pending, 'request waiting for you', 'requests waiting for you') });
  } else if (role === ROLES.STUDENT || role === ROLES.FACULTY) {
    const mine = role === ROLES.STUDENT ? ['studentId', profile.studentId] : ['facultyId', profile.facultyId];
    const decided = await count(query(tcol(iid, 'requests'), where(mine[0], '==', mine[1]), where('decidedAt', '>', Timestamp.fromDate(since('requestsSeenAt')))));
    if (decided) items.push({ key: 'requestsSeenAt', to: '/requests', n: decided, text: plural(decided, 'request answered', 'requests answered') });
    if (role === ROLES.STUDENT) {
      // publishedAt is cleared when results are unpublished, so only live results count.
      // Only the student's own semester counts, not every exam in the college.
      const [enrolled] = await list(query(tcol(iid, 'enrollments'), where('studentId', '==', profile.studentId), where('status', '==', 'ACTIVE'), limit(1)));
      const results = enrolled ? await count(query(tcol(iid, 'exams'), where('semesterId', '==', enrolled.semesterId), where('publishedAt', '>', Timestamp.fromDate(since('resultsSeenAt'))))) : 0;
      if (results) items.push({ key: 'resultsSeenAt', to: '/exams', n: results, text: plural(results, 'new result published', 'new results published') });
    }
  }
  return items;
}

export default function Bell() {
  const ctx = useCtx();
  const { iid, uid } = ctx;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  // Page loads reuse the last answer for 10 minutes (per tab); opening the bell always asks again.
  const memo = `bell:${uid}`;
  const heard = useRef(null); // how many were waiting at the last look; null until the first look
  const refresh = useCallback(async (fresh = false) => {
    try {
      const hit = fresh ? null : stash.get(memo);
      if (hit && Date.now() - hit.at < 10 * 60 * 1000) { heard.current = sum(hit.items); setItems(hit.items); return; }
      const found = await loadNotices(ctx);
      if (heard.current !== null && sum(found) > heard.current && soundOn()) chime(); // something new arrived while the page was open
      heard.current = sum(found);
      setItems(found);
      stash.set(memo, { at: Date.now(), items: found });
      setError('');
    } catch (e) { setError('Could not check for news.'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iid, uid]);
  useEffect(() => { refresh(); }, [refresh]);

  // Live changes refresh the bell (above); this also asks again when you come back to the tab, in case it slept.
  // Each ask is a handful of reads, and never more often than every 30 seconds.
  const live = useLive();
  useEffect(() => { if (live) refresh(true); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastAsk = useRef(Date.now());
  const askAgain = useCallback(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastAsk.current < 30000) return;
    lastAsk.current = Date.now();
    refresh(true);
  }, [refresh]);
  useEffect(() => {
    document.addEventListener('visibilitychange', askAgain);
    window.addEventListener('focus', askAgain);
    return () => { document.removeEventListener('visibilitychange', askAgain); window.removeEventListener('focus', askAgain); };
  }, [askAgain]);

  const markSeen = async (keys) => {
    const fields = Object.fromEntries([...new Set(keys.filter(Boolean))].map((k) => [k, serverTimestamp()]));
    if (!Object.keys(fields).length) return;
    await setDoc(tdoc(iid, 'readState', uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
    stash.drop(memo);
  };
  const visit = async (item) => {
    setOpen(false);
    const rest = items.filter((x) => x !== item);
    heard.current = sum(rest); // so the next arrival is compared with what is left, not the old high mark
    setItems(rest);
    await markSeen([item.key]).catch(() => {});
  };
  const clear = async () => {
    await markSeen(items.map((x) => x.key)).catch(() => {});
    const rest = items.filter((x) => !x.key);
    heard.current = sum(rest);
    setItems(rest);
  };
  const total = sum(items);
  const [sound, setSound] = useState(soundOn);
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem('bellSound', next ? 'on' : 'off'); } catch { /* blocked: lasts until reload */ }
    if (next) chime(); // a click is allowed to make sound, so this also lets the browser play later chimes
  };

  return (
    <>
      <button type="button" className={iconBtn} onClick={() => { setOpen(true); refresh(true); }}
        aria-label={total ? `Notifications, ${total} new` : 'Notifications'}>
        <BellGlyph size={18} />
        {total > 0 && <span className="absolute top-[3px] right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-card bg-alert px-[5px] text-[11px] font-bold text-white" aria-hidden="true">{total > 9 ? '9+' : total}</span>}
      </button>
      {open && (
        <Modal title="What's new" onClose={() => setOpen(false)}>
          {error && <p className="muted">{error}</p>}
          {!items.length && !error && <p className="muted">You are all caught up.</p>}
          <ul className={linkList}>
            {items.map((item) => (
              <li key={item.to}>
                <Link to={item.to} onClick={() => visit(item)}>{item.text}</Link>
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <Button onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Sound on. Turn off' : 'Sound off. Turn on'} title={sound ? 'Sound on' : 'Sound off'}>{sound ? '🔔' : '🔕'}</Button>
            {items.some((x) => x.key) && <Button onClick={clear}>Mark all as read</Button>}
            <Button variant="primary" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

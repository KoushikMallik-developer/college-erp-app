import { useEffect, useState } from 'react';
import { limit, query, where } from 'firebase/firestore';
import { useCtx } from '../../app/AuthProvider';
import { ROLES, tcol } from '../../lib/tenant';
import { classAlerts } from '../../lib/calc';
import { list } from '../../lib/data';
import { stash } from '../../lib/stash';
import { useToast } from '../../components/ui';
import { chime, soundOn } from '../../components/Bell';

// The signed-in student's or teacher's timetable slots. One read set per tab for 30 minutes, shared by the card and the watcher.
const loading = {};
async function mySlots({ iid, uid, role, profile }) {
  const key = `slots:${uid}`;
  const hit = stash.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.slots;
  loading[key] ??= (async () => {
    let slots = [];
    if (role === ROLES.FACULTY) {
      slots = await list(query(tcol(iid, 'timetableSlots'), where('facultyId', '==', profile.facultyId)));
    } else if (role === ROLES.STUDENT) {
      const [e] = await list(query(tcol(iid, 'enrollments'), where('studentId', '==', profile.studentId), where('status', '==', 'ACTIVE'), limit(1)));
      if (e) slots = await list(query(tcol(iid, 'timetableSlots'), where('sectionId', '==', e.sectionId)));
    }
    slots = slots.filter((s) => s.startTime).map(({ id, dayOfWeek, startTime, endTime, subjectName, facultyName, room }) => ({ id, dayOfWeek, startTime, endTime, subjectName, facultyName, room }));
    stash.set(key, { at: Date.now(), slots });
    return slots;
  })().finally(() => { delete loading[key]; });
  return loading[key];
}

// Re-reads the clock every 30 seconds while mounted. A slept tab catches up on its next tick.
function useClock() {
  const { now } = useCtx();
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), 30000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return t;
}

function useSlots() {
  const ctx = useCtx();
  const [slots, setSlots] = useState(null);
  useEffect(() => {
    let live = true;
    mySlots(ctx).then((s) => live && setSlots(s), () => live && setSlots([])); // no timetable access or a failed read: simply nothing to show
    return () => { live = false; };
  }, [ctx.iid, ctx.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  return slots;
}

const MESSAGE = {
  upcoming: (s) => `Upcoming: ${s.subjectName} at ${s.startTime}${s.room ? `, room ${s.room}` : ''}`,
  started: (s) => `Started: ${s.subjectName}${s.room ? `, room ${s.room}` : ''}, until ${s.endTime}`,
  ended: (s) => `Ended: ${s.subjectName}`,
};

// Renders nothing. Pops a message when a class is about to start, has started, or has ended.
export function ClassWatcher() {
  const { today } = useCtx();
  const toast = useToast();
  const slots = useSlots();
  const { day, minutes } = useClock();
  useEffect(() => {
    if (!slots) return;
    let rang = false;
    for (const { kind, slot } of classAlerts(slots, day, minutes)) {
      const key = `alert:${today()}_${slot.id}_${kind}`; // once per class per kind, even if the page reloads
      if (stash.get(key)) continue;
      stash.set(key, 1);
      toast(MESSAGE[kind](slot));
      if (!rang && soundOn()) { chime(); rang = true; }
    }
  }, [slots, day, minutes]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const mins = (hhmm) => { const [h, m] = hhmm.split(':'); return Number(h) * 60 + Number(m); };
const span = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`);

export default function ClassNow() {
  const slots = useSlots();
  const { day, minutes } = useClock();
  if (!slots?.length) return null; // no timetable with times yet
  const today = slots.filter((s) => s.dayOfWeek === day).sort((x, y) => mins(x.startTime) - mins(y.startTime));
  if (!today.length) return null;
  const state = (s) => (minutes >= mins(s.endTime) ? 'done' : minutes >= mins(s.startTime) ? 'live' : 'soon');
  const current = today.find((s) => state(s) === 'live');
  const next = today.find((s) => state(s) === 'soon');
  const done = today.filter((s) => state(s) === 'done').length;
  const who = (s) => [s.facultyName, s.room && `Room ${s.room}`].filter(Boolean).join(' · ');
  const focus = current ?? next;
  const total = current ? mins(current.endTime) - mins(current.startTime) : 0;
  const left = current ? mins(current.endTime) - minutes : 0;
  return (
    <section className={`card relative overflow-hidden ${current ? 'border-ok!' : next && mins(next.startTime) - minutes <= 10 ? 'border-warn!' : ''}`} aria-label="Your classes today">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 mr-auto">Your classes today</h2>
        <span className="text-xs font-medium text-muted">{done} of {today.length} done</span>
      </div>

      {focus ? (
        <div className={`mb-4 rounded-xl p-4 ${current ? 'bg-ok-soft' : 'bg-brand-soft'}`} aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            {current
              ? <><span className="relative flex size-2.5"><span className="absolute inline-flex size-full rounded-full bg-ok opacity-60 motion-safe:animate-live" /><span className="relative inline-flex size-2.5 rounded-full bg-ok" /></span><span className="text-ok">In class now</span></>
              : <span className="text-brand-deep">Next up · in {span(mins(next.startTime) - minutes)}</span>}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <div className="truncate text-[22px] leading-tight font-semibold">{focus.subjectName}</div>
              <div className="mt-0.5 text-[13px] text-muted">{who(focus)}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums">{focus.startTime} – {focus.endTime}</div>
              {current && <div className="text-xs font-medium text-ok">{span(left)} left</div>}
            </div>
          </div>
          {current && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card" role="progressbar" aria-label="Class progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((total - left) / total) * 100)}>
              <div className="h-full rounded-full bg-ok motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${((total - left) / total) * 100}%` }} />
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-ok-soft p-4 text-[14px] font-medium text-ok">All {today.length} classes are done for today.</div>
      )}

      <ol className="m-0 list-none p-0">
        {today.map((s) => {
          const st = state(s);
          return (
            <li key={s.id} className={`flex items-center gap-3 border-t border-line py-2.5 text-[13.5px] first:border-t-0 ${st === 'done' ? 'opacity-55' : ''}`} aria-current={st === 'live' ? 'true' : undefined}>
              <span className={`size-2.5 flex-none rounded-full ${st === 'live' ? 'bg-ok' : st === 'soon' ? 'border-2 border-brand' : 'bg-line'}`} aria-hidden="true" />
              <span className="w-[92px] flex-none text-xs tabular-nums text-muted">{s.startTime}–{s.endTime}</span>
              <span className={`min-w-0 flex-1 truncate ${st === 'live' ? 'font-semibold' : 'font-medium'}`}>{s.subjectName}</span>
              {s.room && <span className="flex-none text-xs text-muted phone:hidden">Room {s.room}</span>}
              <span className="sr-only">{st === 'live' ? 'in progress' : st === 'done' ? 'finished' : 'later today'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

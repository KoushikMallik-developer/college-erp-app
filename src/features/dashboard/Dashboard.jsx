import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, FileText, MessageSquare, Star } from 'lucide-react';
import { doc, getAggregateFromServer, getCountFromServer, getDoc, limit, orderBy, query, sum, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCtx } from '../../app/AuthProvider';
import { tcol, isAdminRole, ROLES } from '../../lib/tenant';
import { attendanceBySubject, attendanceStreak, percent } from '../../lib/calc';
import { byId, list } from '../../lib/data';
import { Alert, Badge, Loading, PageHeader, useAsync, agendaDate, agendaList } from '../../components/ui';
import { Bars, Mascot, Ring, greeting } from '../../components/widgets';
import ClassNow from './ClassNow';
import { AnnouncementList } from '../announcements/Announcements';
import { UpcomingEvents } from '../calendar/Calendar';

const count = async (q) => (await getCountFromServer(q)).data().count;

const dayBefore = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

// Attendance for the last 7 days (one aggregate read per day, not one read per register) and what needs an admin's decision.
function AdminOverview() {
  const { iid, today } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const days = Array.from({ length: 7 }, (_, i) => dayBefore(today(), 6 - i));
    const [bars, leave, grievance, drafts] = await Promise.all([
      Promise.all(days.map(async (date) => {
        const t = (await getAggregateFromServer(query(tcol(iid, 'classSessions'), where('date', '==', date)), { present: sum('presentCount'), absent: sum('absentCount') })).data();
        return { date, pct: percent(t.present, t.absent) };
      })),
      count(query(tcol(iid, 'requests'), where('status', '==', 'PENDING'), where('kind', '==', 'LEAVE'))),
      count(query(tcol(iid, 'requests'), where('status', '==', 'PENDING'), where('kind', '==', 'GRIEVANCE'))),
      count(query(tcol(iid, 'exams'), where('status', '==', 'DRAFT'))),
    ]);
    return { bars, queue: [['/requests', 'Leave requests to decide', leave], ['/requests', 'Grievances to resolve', grievance], ['/exams', 'Exams not yet published', drafts]] };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const week = data.bars.filter((b) => b.pct !== null);
  return (
    <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 [&>.card]:mb-0">
      <div className="card">
        <h2>Attendance overview</h2>
        <p className="muted">Share of students present, last 7 days{week.length ? ` · average ${Math.round(week.reduce((n, b) => n + b.pct, 0) / week.length)}%` : ''}</p>
        <Bars
          ariaLabel={data.bars.map((b) => `${b.date}: ${b.pct === null ? 'no registers' : `${b.pct} percent`}`).join(', ')}
          items={data.bars.map((b) => ({ key: b.date, pct: b.pct, now: b.date === today(), label: new Date(`${b.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }), title: `${b.date}: ${b.pct === null ? 'no registers' : `${b.pct}%`}` }))}
        />
      </div>
      <div className="card">
        <h2>Review queue</h2>
        <p className="muted">What is waiting for you</p>
        <ul className="mx-0 mt-3.5 mb-0 list-none p-0 [&_a]:flex [&_a]:items-center [&_a]:justify-between [&_a]:gap-3 [&_a]:py-3.5 [&_a]:text-[13.5px] [&_a]:font-medium [&_a]:text-ink [&_a]:no-underline [&_a:hover_span]:text-brand-deep [&_li+li]:border-t [&_li+li]:border-line">
          {data.queue.map(([to, label, n]) => (
            <li key={label}><Link to={to}><span>{label}</span><Badge kind={n ? 'warn' : 'ok'}>{n}</Badge></Link></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdminStats() {
  const { iid } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const [students, faculty, departments, courses, pending] = await Promise.all([
      count(query(tcol(iid, 'students'), where('status', '==', 'ACTIVE'))),
      count(query(tcol(iid, 'faculty'), where('status', '==', 'ACTIVE'))),
      count(tcol(iid, 'departments')),
      count(tcol(iid, 'courses')),
      count(query(tcol(iid, 'requests'), where('status', '==', 'PENDING'))),
    ]);
    return { students, faculty, departments, courses, pending };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const tiles = [
    ['Active students', data.students], ['Active faculty', data.faculty],
    ['Departments', data.departments], ['Courses', data.courses],
  ];
  return (
    <>
      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 [&>.card]:mb-0">
        {tiles.map(([label, n]) => (
          <div className="card" key={label}><div className="text-4xl leading-[1.1] font-semibold tracking-[-1px] tabular-nums">{n}</div><div className="mt-2 text-xs font-medium text-muted">{label}</div></div>
        ))}
        <Link to="/requests" className="card text-ink no-underline hover:border-brand hover:bg-hover">
          <div className="text-4xl leading-[1.1] font-semibold tracking-[-1px] tabular-nums">{data.pending}</div><div className="mt-2 text-xs font-medium text-muted">Student requests waiting</div>
        </Link>
      </div>
      <AdminOverview />
    </>
  );
}

const BADGES = [
  ['First step', 'Your first class is on record', (d) => d.marked > 0],
  ['Safe zone', 'Attendance of 75% or more', (d) => d.overall !== null && d.overall >= 75],
  ['Steady', 'Attendance of 90% or more', (d) => d.overall !== null && d.overall >= 90],
  ['On a roll', 'Five days present in a row', (d) => d.streak >= 5],
];
const TILES = [
  ['/attendance', 'My attendance', ClipboardCheck],
  ['/exams', 'My results', FileText],
  ['/calendar', 'Calendar', CalendarDays],
  ['/requests', 'Ask or tell us', MessageSquare],
];

function StudentHome() {
  const { iid, profile, today } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const [docs, subjects] = await Promise.all([
      list(query(tcol(iid, 'studentAttendance'), where('studentId', '==', profile.studentId))),
      list(tcol(iid, 'subjects')),
    ]);
    const names = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const by = attendanceBySubject(docs);
    const t = Object.values(by);
    const sum = (k) => t.reduce((n, x) => n + x[k], 0);
    const subjectBars = Object.entries(by).map(([id, x]) => ({ key: id, label: names[id] ?? id, pct: x.percent }));
    // Record keys are dYYYYMMDD_period: count every subject's marks that fall on each of the last 7 days.
    const dayBars = Array.from({ length: 7 }, (_, i) => {
      const date = dayBefore(today(), 6 - i), tag = `d${date.replaceAll('-', '')}_`;
      const marks = docs.flatMap((d) => Object.entries(d.records ?? {}).filter(([k]) => k.startsWith(tag)).map(([, v]) => v));
      return { key: date, pct: percent(marks.filter((v) => v === 'PRESENT').length, marks.filter((v) => v === 'ABSENT').length), label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }), now: date === today(), title: `${date}: ${marks.length ? `${marks.length} classes` : 'no classes'}` };
    });
    return { overall: percent(sum('present'), sum('absent')), dayBars, marked: sum('present') + sum('absent') + sum('leave'), streak: attendanceStreak(docs), subjectBars };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const low = data.overall !== null && data.overall < 75;
  const message = data.overall === null ? 'Your attendance will show up here once your teachers take their first register.'
    : data.overall >= 90 ? 'Superstar! Your attendance is brilliant. Keep it going.'
    : data.overall >= 75 ? 'You are on track. Every class you attend keeps you there.'
    : 'Careful: you are under 75%. Try not to miss the next few classes.';
  return (
    <>
      <section className="card flex flex-wrap items-center gap-6 border-brand/22 bg-brand-soft px-[26px] py-[22px]">
        <Mascot size={96} mood={low ? 'worried' : 'happy'} />
        <div className="min-w-[230px] flex-1 [&_h1]:mb-1.5 [&_h1]:text-[clamp(24px,3.4vw,34px)] [&_p]:my-1 [&_p]:text-muted">
          <h1>{greeting()}, {profile.displayName.split(' ')[0]}!</h1>
          <p>{message}</p>
          {data.streak > 1 && <p className="inline-block rounded-[6px] border border-warn bg-warn-soft px-3 py-0.5 text-xs font-semibold text-warn!">{data.streak} days present in a row</p>}
        </div>
        <Ring value={data.overall} label="Overall attendance" />
      </section>
      <ClassNow />
      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {TILES.map(([to, label, Glyph]) => (
          <Link to={to} className="card m-0 flex min-h-28 flex-col justify-between gap-[18px] p-[18px] text-[13px] font-semibold text-ink no-underline motion-safe:transition hover:border-brand hover:bg-brand-soft [&>svg]:text-muted hover:[&>svg]:text-brand" key={to}><Glyph size={28} /><span>{label}</span></Link>
        ))}
      </div>
      {data.subjectBars.length > 0 && (
        <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 [&>.card]:mb-0">
          <div className="card">
            <h2>Attendance by subject</h2>
            <p className="muted">Bars under 75% are marked in red.</p>
            <Bars ariaLabel={data.subjectBars.map((b) => `${b.label}: ${b.pct === null ? 'no data' : `${b.pct} percent`}`).join(', ')} items={data.subjectBars} />
          </div>
          <div className="card">
            <h2>Attendance by day</h2>
            <p className="muted">All your classes, last 7 days. Days without classes are empty.</p>
            <Bars ariaLabel={data.dayBars.map((b) => `${b.key}: ${b.pct === null ? 'no classes' : `${b.pct} percent`}`).join(', ')} items={data.dayBars} />
          </div>
        </div>
      )}
      <div className="card">
        <h2>Your badges</h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 p-0">
          {BADGES.map(([name, how, earned]) => (
            <li key={name} className={`grid gap-1 rounded-md p-4 ${earned(data) ? 'border border-warn/40 bg-warn-soft' : 'border border-dashed border-field opacity-70'}`}>
              <span className={earned(data) ? 'text-star' : 'text-muted'} aria-hidden="true"><Star size={22} /></span>
              <strong>{name}</strong>
              <span className="muted">{earned(data) ? how : `Locked: ${how}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

const ROW = 'flex items-center justify-between gap-3 border-t border-line py-2.5 text-[13.5px]';

// The teacher's own page: the classes they own, their own attendance this month, their leave, and how their registers are going.
function FacultySummary() {
  const { iid, profile, today } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const from = dayBefore(today(), 6);
    const month = `${today().slice(0, 7)}-01`;
    const [assigned, sections, courses, departments, years, semesters, mine, requests, sessions] = await Promise.all([
      list(query(tcol(iid, 'teachingAssignments'), where('facultyId', '==', profile.facultyId), where('active', '==', true))),
      list(tcol(iid, 'sections')),
      list(tcol(iid, 'courses')),
      list(tcol(iid, 'departments')),
      list(tcol(iid, 'academicYears')),
      list(tcol(iid, 'semesters')),
      list(query(tcol(iid, 'facultyAttendance'), where('facultyId', '==', profile.facultyId))).catch(() => []),
      list(query(tcol(iid, 'requests'), where('facultyId', '==', profile.facultyId))).catch(() => []),
      // The chart is optional: if it cannot load (for example its index is still building) the rest still shows.
      list(query(tcol(iid, 'classSessions'), where('facultyId', '==', profile.facultyId), where('date', '>=', from))).catch((e) => e),
    ]);
    const S = byId(sections), C = byId(courses), D = byId(departments), Y = byId(years), M = byId(semesters);
    const classes = assigned.map((a) => {
      const s = S[a.sectionId];
      const course = C[s?.courseId];
      const where = [D[course?.departmentId]?.name, course?.name, Y[s?.academicYearId]?.name, M[s?.semesterId]?.name].filter(Boolean);
      return { id: a.id, subject: a.subjectName, section: s?.name ?? '—', where: where.join(' · ') };
    }).sort((x, y) => x.subject.localeCompare(y.subject));
    const marks = mine.filter((m) => m.date >= month);
    const count = (s) => marks.filter((m) => m.status === s).length;
    const leaves = requests.filter((r) => r.kind === 'LEAVE' && ['PENDING', 'APPROVED'].includes(r.status) && r.toDate >= today()).sort((x, y) => x.fromDate.localeCompare(y.fromDate));
    const base = { classes, attendance: { present: count('PRESENT'), absent: count('ABSENT'), leave: count('LEAVE'), marked: marks.length }, leaves };
    if (sessions instanceof Error) return { ...base, chartError: sessions.message };
    const bars = Array.from({ length: 7 }, (_, i) => {
      const date = dayBefore(today(), 6 - i);
      const day = sessions.filter((s) => s.date === date);
      return { date, pct: percent(day.reduce((n, s) => n + s.presentCount, 0), day.reduce((n, s) => n + s.absentCount, 0)), registers: day.length };
    });
    return { ...base, bars };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const { attendance: att } = data;
  return (
    <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 [&>.card]:mb-0">
      <div className="card">
        <h2>Classes you teach</h2>
        {data.classes.length === 0 ? <p className="muted mt-0">No classes are assigned to you yet.</p> : (
          <ul className="m-0 list-none p-0">
            {data.classes.map((c) => <li className={ROW} key={c.id}><div><strong className="font-semibold">{c.subject}</strong>{c.where && <div className="muted text-xs">{c.where}</div>}</div><span className="muted">{c.section}</span></li>)}
          </ul>
        )}
      </div>
      <div className="card">
        <h2>My attendance and leave</h2>
        <p className="muted mt-0">{att.marked ? 'Marked by the office this month' : 'Nothing marked for you this month yet'}</p>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[['Present', att.present, 'text-ok'], ['Absent', att.absent, 'text-bad'], ['On leave', att.leave, 'text-warn']].map(([k, v, tone]) => (
            <div key={k}><div className={`text-[28px] leading-none font-semibold tabular-nums ${tone}`}>{v}</div><div className="mt-1 text-[11px] font-medium text-muted">{k}</div></div>
          ))}
        </div>
        <h3 className="mb-0 text-[13px]">Leave</h3>
        {data.leaves.length === 0 ? <p className="muted mt-1">No leave waiting or coming up.</p> : (
          <ul className="m-0 list-none p-0">
            {data.leaves.slice(0, 3).map((r) => (
              <li className={ROW} key={r.id}>
                <span>{r.fromDate === r.toDate ? r.fromDate : `${r.fromDate} to ${r.toDate}`}</span>
                <Badge kind={r.status === 'APPROVED' ? 'ok' : 'warn'}>{r.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 mb-0"><Link to="/requests">Ask for leave</Link></p>
      </div>
      <div className="card">
        <h2>Attendance in your classes</h2>
        <p className="muted">Share of students present, last 7 days</p>
        {data.chartError ? <Alert kind="error">{data.chartError}</Alert> : <Bars
          ariaLabel={data.bars.map((b) => `${b.date}: ${b.pct === null ? 'no registers' : `${b.pct} percent`}`).join(', ')}
          items={data.bars.map((b) => ({ key: b.date, pct: b.pct, now: b.date === today(), label: new Date(`${b.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }), title: `${b.date}: ${b.registers} registers${b.pct === null ? '' : `, ${b.pct}% present`}` }))}
        />}
      </div>
    </div>
  );
}

const ACTIONS = {
  STUDENT_DEACTIVATED: 'deactivated a student', STUDENT_REACTIVATED: 'reactivated a student', STUDENT_RENAMED: 'renamed a student',
  FACULTY_DEACTIVATED: 'deactivated a faculty member', FACULTY_REACTIVATED: 'reactivated a faculty member', FACULTY_RENAMED: 'renamed a faculty member',
  USER_CREATED: 'added an admin', USER_DEACTIVATED: 'blocked a user', USER_REACTIVATED: 'unblocked a user',
  RESULTS_PUBLISHED: 'published results', RESULTS_UNPUBLISHED: 'unpublished results', PAPER_REMOVED: 'removed an exam paper',
  MARKS_RECORD_REMOVED: 'removed a marks record', ASSIGNMENT_DEACTIVATED: 'ended a teaching assignment',
};
const sentence = (action) => ACTIONS[action] ?? action.toLowerCase().replaceAll('_', ' ');

// The latest audit entries in plain words: 8 reads for the entries plus one per person who made them.
function ActivityFeed() {
  const { iid } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const logs = await list(query(tcol(iid, 'auditLogs'), orderBy('timestamp', 'desc'), limit(8)));
    const names = {};
    await Promise.all([...new Set(logs.map((l) => l.actorUid))].map(async (id) => {
      names[id] = (await getDoc(doc(db, 'users', id)).catch(() => null))?.data()?.displayName ?? 'Someone';
    }));
    return logs.map((l) => ({ ...l, who: names[l.actorUid] }));
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  return data.length === 0 ? <p className="muted">Nothing has happened yet.</p> : (
    <ul className={agendaList}>
      {data.map((l) => (
        <li key={l.id}><span className={agendaDate}>{l.timestamp?.toDate?.().toLocaleString()}</span> {l.who} {sentence(l.action)}</li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { role, profile } = useCtx();
  return (
    <>
      {role === ROLES.STUDENT ? <StudentHome /> : <PageHeader title={`Hello, ${profile.displayName}`} />}
      {isAdminRole(role) && <AdminStats />}
      {role === ROLES.FACULTY && <><ClassNow /><FacultySummary /></>}
      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 [&>.card]:mb-0">
        <div className="card">
          <h2>Announcements</h2>
          <AnnouncementList limitTo={5} />
        </div>
        <div className="card">
          <h2>Coming up</h2>
          <UpcomingEvents />
        </div>
      </div>
      {isAdminRole(role) && (
        <div className="card">
          <h2>Recent activity</h2>
          <ActivityFeed />
        </div>
      )}
    </>
  );
}

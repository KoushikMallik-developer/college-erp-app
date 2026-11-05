import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, FileText, MessageSquare, Star } from 'lucide-react';
import { doc, getAggregateFromServer, getCountFromServer, getDoc, limit, orderBy, query, sum, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCtx } from '../../app/AuthProvider';
import { tcol, isAdminRole, ROLES } from '../../lib/tenant';
import { attendanceBySubject, attendanceStreak, percent } from '../../lib/calc';
import { list } from '../../lib/data';
import { Alert, Badge, Loading, PageHeader, useAsync } from '../../components/ui';
import { Bars, Mascot, Ring, greeting } from '../../components/widgets';
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
    <div className="grid two">
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
        <ul className="queue">
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
      <div className="grid">
        {tiles.map(([label, n]) => (
          <div className="card" key={label}><div className="stat">{n}</div><div className="stat-label">{label}</div></div>
        ))}
        <Link to="/requests" className="card tile-link">
          <div className="stat">{data.pending}</div><div className="stat-label">Student requests waiting</div>
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
      <section className="card hero-card">
        <Mascot size={96} mood={low ? 'worried' : 'happy'} />
        <div className="hero-text">
          <h1>{greeting()}, {profile.displayName.split(' ')[0]}!</h1>
          <p>{message}</p>
          {data.streak > 1 && <p className="streak">{data.streak} days present in a row</p>}
        </div>
        <Ring value={data.overall} label="Overall attendance" />
      </section>
      <div className="tiles">
        {TILES.map(([to, label, Glyph]) => (
          <Link to={to} className="card tile" key={to}><Glyph size={28} /><span>{label}</span></Link>
        ))}
      </div>
      {data.subjectBars.length > 0 && (
        <div className="grid two">
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
        <ul className="badges">
          {BADGES.map(([name, how, earned]) => (
            <li key={name} className={earned(data) ? 'got' : ''}>
              <span className="badge-star" aria-hidden="true"><Star size={22} /></span>
              <strong>{name}</strong>
              <span className="muted">{earned(data) ? how : `Locked: ${how}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function FacultySummary() {
  const { iid, profile, today } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const from = dayBefore(today(), 6);
    const [classes, sessions] = await Promise.all([
      count(query(tcol(iid, 'teachingAssignments'), where('facultyId', '==', profile.facultyId), where('active', '==', true))),
      // The chart is optional: if it cannot load (for example its index is still building) the class count still shows.
      list(query(tcol(iid, 'classSessions'), where('facultyId', '==', profile.facultyId), where('date', '>=', from))).catch((e) => e),
    ]);
    if (sessions instanceof Error) return { classes, chartError: sessions.message };
    const bars = Array.from({ length: 7 }, (_, i) => {
      const date = dayBefore(today(), 6 - i);
      const day = sessions.filter((s) => s.date === date);
      return { date, pct: percent(day.reduce((n, s) => n + s.presentCount, 0), day.reduce((n, s) => n + s.absentCount, 0)), registers: day.length };
    });
    return { classes, bars };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  return (
    <div className="grid two">
      <div className="card"><div className="stat">{data.classes}</div><div className="stat-label">Classes you teach now</div></div>
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
    <ul className="agenda">
      {data.map((l) => (
        <li key={l.id}><span className="agenda-date">{l.timestamp?.toDate?.().toLocaleString()}</span> {l.who} {sentence(l.action)}</li>
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
      {role === ROLES.FACULTY && <FacultySummary />}
      <div className="grid two">
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

import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCtx } from '../../app/AuthProvider';
import { ROLES, tcol, tdoc } from '../../lib/tenant';
import { audit } from '../../lib/audit';
import { STATUSES, attendanceBySubject, attendanceEntries, groupByCost, percent, planAttendanceWrites, recordKey, toCsv } from '../../lib/calc';
import { byId, chunk, list } from '../../lib/data';
import { searchPeople } from '../../components/SearchPalette';
import { Alert, Badge, Button, Input, Loading, PageHeader, Select, Table, Tabs, downloadCsv, useAction, useAsync } from '../../components/ui';

export default function Attendance() {
  const { role } = useCtx();
  if (role === ROLES.STUDENT) return <><PageHeader title="My attendance" /><MyAttendance /></>;
  if (role === ROLES.FACULTY) return <><PageHeader title="Attendance" /><ClassRegister /></>;
  return <AdminAttendance />;
}

function AdminAttendance() {
  const [tab, setTab] = useState('reports');
  return (
    <>
      <PageHeader title="Attendance" />
      <Tabs value={tab} onChange={setTab}
        tabs={[{ value: 'reports', label: 'Class reports' }, { value: 'student', label: 'By student' }, { value: 'faculty', label: 'Faculty attendance' }]} />
      {tab === 'reports' ? <Reports /> : tab === 'student' ? <StudentLookup /> : <FacultyRegister />}
    </>
  );
}

function StatusButtons({ value, onChange }) {
  return (
    <div className="status-group" role="group">
      {STATUSES.map((s) => (
        <button key={s} type="button" className={s} aria-pressed={value === s} onClick={() => onChange(s)}>
          {s[0] + s.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function ClassRegister() {
  const { iid, uid, profile, today } = useCtx();
  const [assignmentId, setAssignmentId] = useState('');
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState('1');
  const assignments = useAsync(
    () => list(query(tcol(iid, 'teachingAssignments'), where('facultyId', '==', profile.facultyId), where('active', '==', true))),
    [iid],
  );
  if (assignments.loading) return <Loading />;
  const a = assignments.data.find((x) => x.id === assignmentId);
  return (
    <>
      <Alert kind="error">{assignments.error?.message}</Alert>
      <div className="row mb">
        <Select label="Class" value={assignmentId} onChange={setAssignmentId}
          options={assignments.data.map((x) => ({ value: x.id, label: x.subjectName }))} />
        <Input label="Date" type="date" max={today()} value={date} onChange={setDate} />
        <Select label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: String(p), label: String(p) }))} />
      </div>
      {assignments.data.length === 0 && <Alert kind="info">You have no active classes. Ask an admin to assign you to one.</Alert>}
      {a && date && <Register key={`${a.id}${date}${period}`} a={a} date={date} period={Number(period)} ctx={{ iid, uid }} />}
    </>
  );
}

function Register({ a, date, period, ctx }) {
  const key = recordKey(date, period);
  const { data, loading, error, reload } = useAsync(async () => {
    const [enrollments, saved] = await Promise.all([
      list(query(tcol(ctx.iid, 'enrollments'), where('semesterId', '==', a.semesterId), where('sectionId', '==', a.sectionId))),
      list(query(tcol(ctx.iid, 'studentAttendance'), where('assignmentId', '==', a.id), where('facultyId', '==', a.facultyId))),
    ]);
    const roster = enrollments.filter((e) => e.status === 'ACTIVE').sort((x, y) => x.enrollmentNumber.localeCompare(y.enrollmentNumber));
    return { roster, saved: byId(saved.map((d) => ({ ...d, id: d.studentId }))) };
  }, [a.id, key]);
  const [picked, setPicked] = useState({});
  const { busy, error: err, done, run } = useAction();

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const earlier = (s) => data.saved[s.studentId]?.records?.[key];
  const statusOf = (s) => picked[s.studentId] ?? earlier(s) ?? 'PRESENT';

  const save = () =>
    run(async () => {
      const writes = planAttendanceWrites(data.roster, data.saved, key, statusOf).map(({ student: s, next, kind, old }) => {
        const ref = tdoc(ctx.iid, 'studentAttendance', `${s.studentId}_${a.id}`);
        const stamp = { updatedBy: ctx.uid, updatedAt: serverTimestamp() };
        // cost = rule lookups: a new record checks the enrollment (1); an edit checks its audit entry (exists + existsAfter, 2).
        if (kind === 'create') {
          return {
            cost: 1,
            run: (b) => b.set(ref, {
              studentId: s.studentId, subjectId: a.subjectId, semesterId: a.semesterId, sectionId: a.sectionId,
              assignmentId: a.id, facultyId: a.facultyId, records: { [key]: next }, createdAt: serverTimestamp(), ...stamp,
            }),
          };
        }
        if (kind === 'add') return { cost: 0, run: (b) => b.update(ref, { [`records.${key}`]: next, ...stamp }) };
        // Changing an existing mark: each edit gets its own new audit entry with the old and new value.
        return {
          cost: 2,
          run: (b) => {
            const auditId = audit(b, ctx, 'ATTENDANCE_EDIT', 'studentAttendance', ref.id, { key, old, new: next });
            b.update(ref, { [`records.${key}`]: next, ...stamp, auditId });
          },
        };
      });
      const counts = { PRESENT: 0, ABSENT: 0, LEAVE: 0 };
      data.roster.forEach((s) => counts[statusOf(s)]++);
      const session = {
        assignmentId: a.id, sectionId: a.sectionId, subjectId: a.subjectId, facultyId: a.facultyId, date, period,
        presentCount: counts.PRESENT, absentCount: counts.ABSENT, leaveCount: counts.LEAVE, updatedAt: serverTimestamp(),
      };
      // The rules allow about 20 lookups per batch and 3 are always used (user, college, assignment): stay at 14.
      const groups = groupByCost(writes, 14);
      for (let i = 0; i < groups.length; i++) {
        const batch = writeBatch(db);
        groups[i].forEach((w) => w.run(batch));
        if (i === groups.length - 1) batch.set(tdoc(ctx.iid, 'classSessions', `${a.id}_${date}_${period}`), session);
        await batch.commit();
      }
      if (!groups.length) {
        const batch = writeBatch(db);
        batch.set(tdoc(ctx.iid, 'classSessions', `${a.id}_${date}_${period}`), session);
        await batch.commit();
      }
      setPicked({});
      reload();
    }, 'Attendance saved.');

  return (
    <div className="card">
      <Alert kind="error">{err}</Alert>
      <Alert kind="ok">{done}</Alert>
      {data.roster.length === 0 ? <p className="muted">No active students are enrolled in this section.</p> : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <Button small onClick={() => setPicked(Object.fromEntries(data.roster.map((s) => [s.studentId, 'PRESENT'])))}>All present</Button>
            <span className="muted">Students already marked for this period show "saved". Changing a saved mark is logged.</span>
          </div>
          <Table plain
            rows={data.roster.map((s) => ({ ...s, id: s.studentId }))}
            columns={[
              { key: 'enrollmentNumber', label: 'Enrollment no.' },
              { key: 'studentName', label: 'Name' },
              { key: 'status', label: 'Status', render: (s) => <StatusButtons value={statusOf(s)} onChange={(v) => setPicked({ ...picked, [s.studentId]: v })} /> },
              { key: 'saved', label: '', render: (s) => earlier(s) && <Badge>saved</Badge> },
            ]}
          />
          <div className="row mt">
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save attendance'}</Button>
          </div>
        </>
      )}
    </div>
  );
}

function FacultyRegister() {
  const { iid, uid, today } = useCtx();
  const [date, setDate] = useState(today());
  const { data, loading, error, reload } = useAsync(async () => {
    const [faculty, saved] = await Promise.all([
      list(query(tcol(iid, 'faculty'), where('status', '==', 'ACTIVE'))),
      list(query(tcol(iid, 'facultyAttendance'), where('date', '==', date))),
    ]);
    return { faculty, saved: byId(saved.map((d) => ({ ...d, id: d.facultyId }))) };
  }, [iid, date]);
  const [picked, setPicked] = useState({});
  const { busy, error: err, done, run } = useAction();

  const save = () =>
    run(async () => {
      const batch = writeBatch(db);
      for (const [facultyId, status] of Object.entries(picked)) {
        batch.set(tdoc(iid, 'facultyAttendance', `${facultyId}_${date}`), {
          facultyId, date, status, markedBy: uid, updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setPicked({});
      reload();
    }, 'Saved.');

  return (
    <>
      <div className="row mb">
        <Input label="Date" type="date" max={today()} value={date} onChange={(v) => { setDate(v); setPicked({}); }} />
      </div>
      <Alert kind="error">{error?.message || err}</Alert>
      <Alert kind="ok">{done}</Alert>
      {loading ? <Loading /> : (
        <>
          <Table plain
            rows={data.faculty}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'employeeCode', label: 'Code' },
              { key: 'status', label: 'Status', render: (f) => (
                <StatusButtons value={picked[f.id] ?? data.saved[f.id]?.status} onChange={(v) => setPicked({ ...picked, [f.id]: v })} />
              ) },
            ]}
          />
          <div className="row mt">
            <Button variant="primary" disabled={busy || !Object.keys(picked).length} onClick={save}>Save faculty attendance</Button>
          </div>
        </>
      )}
    </>
  );
}

// Record keys look like dYYYYMMDD_p.
function keyInRange(k, from, to) {
  const d = k.slice(1, 9);
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return (!from || iso >= from) && (!to || iso <= to);
}

// Admin: find one student by name or enrollment number and see their attendance in every subject.
function StudentLookup() {
  const { iid } = useCtx();
  const [text, setText] = useState('');
  const [found, setFound] = useState(null);
  const [student, setStudent] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const search = useAction();
  const report = useAsync(async () => {
    if (!student) return null;
    const [docs, subjects] = await Promise.all([
      list(query(tcol(iid, 'studentAttendance'), where('studentId', '==', student.id))),
      list(tcol(iid, 'subjects')),
    ]);
    return { docs, subjects: byId(subjects) };
  }, [iid, student?.id]);

  const go = (e) => {
    e.preventDefault();
    if (text.trim()) search.run(async () => { setStudent(null); setFound((await searchPeople(iid, text)).students); });
  };
  const rows = Object.entries(attendanceBySubject(
    (report.data?.docs ?? []).map((d) => ({ ...d, records: Object.fromEntries(Object.entries(d.records ?? {}).filter(([k]) => keyInRange(k, from, to))) })),
  )).map(([id, t]) => ({ id, subject: report.data.subjects[id]?.name ?? id, ...t }));
  const overall = percent(rows.reduce((n, r) => n + r.present, 0), rows.reduce((n, r) => n + r.absent, 0));

  return (
    <>
      <form className="row mb" onSubmit={go}>
        <Input label="Student name or enrollment number" value={text} onChange={setText} />
        <Button variant="primary" type="submit" disabled={search.busy || !text.trim()}>{search.busy ? 'Searching…' : 'Search'}</Button>
      </form>
      <Alert kind="error">{search.error || report.error?.message}</Alert>
      {found && !student && (found.length === 0 ? <p className="muted">No student found for “{text.trim()}”. Names are matched from the start.</p> : (
        <ul className="results" style={{ marginBottom: 16 }}>
          {found.map((s) => <li key={s.id}><button type="button" className="link" onClick={() => setStudent(s)}>{s.name} <span className="muted">{s.enrollmentNumber}</span></button></li>)}
        </ul>
      ))}
      {student && (
        <>
          <div className="row mb">
            <div className="card" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
              <strong>{student.name}</strong> <span className="muted">{student.enrollmentNumber}</span>
              <div className="stat">{overall === null ? '—' : `${overall}%`}</div><div className="stat-label">Overall attendance</div>
            </div>
            <Input label="From" type="date" value={from} onChange={setFrom} />
            <Input label="To" type="date" value={to} onChange={setTo} />
            <Button onClick={() => setStudent(null)}>Change student</Button>
          </div>
          {report.loading ? <Loading /> : (
            <Table
              rows={rows}
              empty="No attendance recorded for this student yet."
              columns={[
                { key: 'subject', label: 'Subject' }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' },
                { key: 'percent', label: '%', render: (r) => (r.percent === null ? '—' : <Badge kind={r.percent < 75 ? 'bad' : 'ok'}>{r.percent}%</Badge>) },
              ]}
            />
          )}
          <p className="muted">Percentage = present ÷ (present + absent). Leave is not counted.</p>
        </>
      )}
    </>
  );
}

function Reports() {
  const { iid } = useCtx();
  const [assignmentId, setAssignmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [find, setFind] = useState('');
  const assignments = useAsync(() => list(tcol(iid, 'teachingAssignments')), [iid]);
  const report = useAsync(async () => {
    if (!assignmentId) return null;
    const a = assignments.data.find((x) => x.id === assignmentId);
    const [enrollments, docs] = await Promise.all([
      list(query(tcol(iid, 'enrollments'), where('semesterId', '==', a.semesterId), where('sectionId', '==', a.sectionId))),
      list(query(tcol(iid, 'studentAttendance'), where('assignmentId', '==', assignmentId))),
    ]);
    return { enrollments, docs: byId(docs.map((d) => ({ ...d, id: d.studentId }))) };
  }, [assignmentId]);

  const inRange = (k) => keyInRange(k, from, to);
  const rows = (report.data?.enrollments ?? [])
    .map((e) => {
      const d = report.data.docs[e.studentId];
      const filtered = { ...d, records: Object.fromEntries(Object.entries(d?.records ?? {}).filter(([k]) => inRange(k))) };
      const t = Object.values(attendanceBySubject([filtered]))[0] ?? { present: 0, absent: 0, leave: 0, percent: null };
      return { id: e.studentId, enrollmentNumber: e.enrollmentNumber, name: e.studentName, ...t };
    })
    .filter((r) => !find || `${r.enrollmentNumber} ${r.name}`.toLowerCase().includes(find.toLowerCase()));

  const csv = () =>
    downloadCsv('attendance.csv', toCsv([
      ['Enrollment no.', 'Name', 'Present', 'Absent', 'Leave', 'Percent'],
      ...rows.map((r) => [r.enrollmentNumber, r.name, r.present, r.absent, r.leave, r.percent ?? '']),
    ]));

  return (
    <>
      <div className="row mb">
        <Select label="Class (subject and section)" value={assignmentId} onChange={setAssignmentId}
          options={(assignments.data ?? []).map((a) => ({ value: a.id, label: `${a.subjectName} — ${a.facultyName}${a.active ? '' : ' (ended)'}` }))} />
        <Input label="From" type="date" value={from} onChange={setFrom} />
        <Input label="To" type="date" value={to} onChange={setTo} />
        <Input label="Find student" value={find} onChange={setFind} />
        <Button onClick={csv} disabled={!rows.length}>Export CSV</Button>
      </div>
      <Alert kind="error">{report.error?.message}</Alert>
      {report.loading && assignmentId ? <Loading /> : (
        <Table
          rows={rows}
          empty={assignmentId ? 'No students.' : 'Choose a class to see its report.'}
          columns={[
            { key: 'enrollmentNumber', label: 'Enrollment no.' }, { key: 'name', label: 'Name' },
            { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' },
            { key: 'percent', label: '%', render: (r) => (r.percent === null ? '—' : <Badge kind={r.percent < 75 ? 'bad' : 'ok'}>{r.percent}%</Badge>) },
          ]}
        />
      )}
      <p className="muted">Percentage = present ÷ (present + absent). Leave is not counted.</p>
    </>
  );
}

const STATUS_LOOK = { PRESENT: ['ok', 'Present'], ABSENT: ['bad', 'Absent'], LEAVE: ['warn', 'Leave'] };
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// One card per subject; a click opens that subject's marks date by date.
function MyAttendance() {
  const { iid, profile } = useCtx();
  const [open, setOpen] = useState(null);
  const { data, loading, error } = useAsync(async () => {
    const [docs, subjects] = await Promise.all([
      list(query(tcol(iid, 'studentAttendance'), where('studentId', '==', profile.studentId))),
      list(tcol(iid, 'subjects')),
    ]);
    const S = byId(subjects);
    const mine = {};
    for (const d of docs) (mine[d.subjectId] ??= []).push(d);
    return Object.entries(attendanceBySubject(docs)).map(([id, t]) => ({ id, subject: S[id]?.name ?? id, ...t, entries: attendanceEntries(mine[id]) }));
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const present = data.reduce((n, r) => n + r.present, 0);
  const absent = data.reduce((n, r) => n + r.absent, 0);
  const overall = percent(present, absent);
  const current = data.find((r) => r.id === open);

  if (current) {
    return (
      <>
        <Button className="mb" onClick={() => setOpen(null)}><ArrowLeft size={16} aria-hidden="true" /> All subjects</Button>
        <div className="card">
          <h2>{current.subject}</h2>
          <p className="muted">
            {current.percent === null ? 'No percentage yet' : <Badge kind={current.percent < 75 ? 'bad' : 'ok'}>{current.percent}%</Badge>}{' '}
            {current.present} present · {current.absent} absent · {current.leave} leave
          </p>
        </div>
        <Table
          rows={current.entries}
          empty="No classes recorded for this subject yet."
          columns={[
            { key: 'date', label: 'Date', text: (r) => r.date, render: (r) => longDate(r.date) },
            { key: 'period', label: 'Period' },
            { key: 'status', label: 'Status', text: (r) => STATUS_LOOK[r.status]?.[1] ?? r.status, render: (r) => <Badge kind={STATUS_LOOK[r.status]?.[0]}>{STATUS_LOOK[r.status]?.[1] ?? r.status}</Badge> },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <div className="card"><div className="stat">{overall === null ? '—' : `${overall}%`}</div><div className="stat-label">Overall</div></div>
      {!data.length && <p className="muted">No attendance recorded yet.</p>}
      <div className="subjects">
        {data.map((r) => {
          const low = r.percent !== null && r.percent < 75;
          return (
            <button type="button" key={r.id} className="card subject-card" onClick={() => setOpen(r.id)}
              aria-label={`${r.subject}, ${r.percent === null ? 'no percentage yet' : `${r.percent} percent`}. Show date by date`}>
              <span className="subject-top"><strong>{r.subject}</strong><ChevronRight size={18} aria-hidden="true" /></span>
              <span className={`subject-pct${low ? ' low' : ''}`}>{r.percent === null ? '—' : `${r.percent}%`}</span>
              <span className={`subject-bar${low ? ' low' : ''}`} aria-hidden="true"><i style={{ width: `${r.percent ?? 0}%` }} /></span>
              <span className="muted">{r.present} present · {r.absent} absent · {r.leave} leave</span>
            </button>
          );
        })}
      </div>
      <p className="muted">Percentage = present ÷ (present + absent). Leave is not counted. Tap a subject to see each day.</p>
    </>
  );
}

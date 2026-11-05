import { getDoc, query, where } from 'firebase/firestore';
import { useCtx } from '../../app/AuthProvider';
import { tcol, tdoc } from '../../lib/tenant';
import { attendanceBySubject, percent } from '../../lib/calc';
import { byId, list } from '../../lib/data';
import { Alert, Badge, Button, Loading, Table, useAsync } from '../../components/ui';

// Attendance by subject plus every published result, laid out to print on one or two pages.
export default function ReportCard({ student }) {
  const { iid, institution } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const [docs, subjects, exams] = await Promise.all([
      list(query(tcol(iid, 'studentAttendance'), where('studentId', '==', student.id))),
      list(tcol(iid, 'subjects')),
      list(query(tcol(iid, 'exams'), where('status', '==', 'PUBLISHED'))),
    ]);
    const S = byId(subjects);
    const snaps = await Promise.all(exams.map((e) => getDoc(tdoc(iid, 'results', `${e.id}_${student.id}`))));
    return {
      attendance: Object.entries(attendanceBySubject(docs)).map(([id, t]) => ({ id, subject: S[id]?.name ?? id, ...t })),
      results: snaps.flatMap((s, i) => (s.exists() ? [{ id: s.id, ...s.data(), exam: exams[i] }] : [])),
    };
  }, [iid, student.id]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  const overall = percent(data.attendance.reduce((n, r) => n + r.present, 0), data.attendance.reduce((n, r) => n + r.absent, 0));
  const pct = (r) => (r.percent === null ? '—' : <Badge kind={r.percent < 75 ? 'bad' : 'ok'}>{r.percent}%</Badge>);
  return (
    <>
      <div className="row no-print mb"><Button variant="primary" onClick={() => window.print()}>Print / save as PDF</Button></div>
      <div className="card">
        <p className="muted">{institution?.name}</p>
        <h2>Report card: {student.name}</h2>
        <p className="muted">Enrollment {student.enrollmentNumber} · printed {new Date().toLocaleDateString()}</p>
        <h3>Attendance · overall {overall === null ? '—' : `${overall}%`}</h3>
        <Table plain rows={data.attendance} empty="No attendance recorded yet." columns={[
          { key: 'subject', label: 'Subject' }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'leave', label: 'Leave' },
          { key: 'percent', label: '%', render: pct },
        ]} />
      </div>
      {data.results.length === 0 && <p className="muted">No results have been published for this student yet.</p>}
      {data.results.map((r) => (
        <div className="card" key={r.id}>
          <h3>{r.exam.name}</h3>
          <p><strong>{r.total} / {r.maxTotal}</strong> · {r.percentage}% · <Badge kind={r.passed ? 'ok' : 'bad'}>{r.passed ? 'PASS' : 'FAIL'}</Badge></p>
          <Table plain rows={r.subjects.map((s, i) => ({ ...s, id: i }))} columns={[
            { key: 'name', label: 'Subject' }, { key: 'marks', label: 'Marks', render: (s) => (s.absent ? 'Absent' : s.marks) },
            { key: 'maxMarks', label: 'Max' }, { key: 'passMarks', label: 'Pass' },
          ]} />
        </div>
      ))}
    </>
  );
}

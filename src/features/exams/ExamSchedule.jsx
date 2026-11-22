import { getDoc, query, where } from 'firebase/firestore';
import { useCtx } from '../../app/AuthProvider';
import { tcol, tdoc } from '../../lib/tenant';
import { list } from '../../lib/data';
import { Alert, Button, Loading, Table, useAsync } from '../../components/ui';

export const paperTime = (p) => (p.startTime ? `${p.startTime}${p.endTime ? `–${p.endTime}` : ''}` : '—');

function printTicket() {
  document.body.dataset.print = 'ticket';
  window.print();
  delete document.body.dataset.print;
}

// The student's upcoming papers (date today or later) for their current semester, with a printable hall ticket.
export default function ExamSchedule() {
  const { iid, profile, institution, today } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const [enrollment] = await list(query(tcol(iid, 'enrollments'), where('studentId', '==', profile.studentId), where('status', '==', 'ACTIVE')));
    if (!enrollment) return { papers: [] };
    const [exams, student] = await Promise.all([
      list(query(tcol(iid, 'exams'), where('semesterId', '==', enrollment.semesterId))),
      getDoc(tdoc(iid, 'students', profile.studentId)),
    ]);
    const open = exams.filter((e) => e.status === 'DRAFT'); // a published exam is over
    const lists = await Promise.all(open.map((e) => list(query(tcol(iid, 'examSubjects'), where('examId', '==', e.id)))));
    const papers = lists.flatMap((l, i) => l.filter((p) => p.date && p.date >= today()).map((p) => ({ ...p, examName: open[i].name })))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return { papers, number: student.data()?.enrollmentNumber };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  if (!data.papers.length) return null;
  return (
    <div className="card mb-4" id="hall-ticket">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="m-0 mr-auto">Upcoming exams</h2>
        <Button onClick={printTicket}>Print hall ticket</Button>
      </div>
      <p className="muted mt-0 hidden print:block">{institution?.name} · Hall ticket · {profile.displayName}{data.number ? ` · Enrollment ${data.number}` : ''}</p>
      <Table
        rows={data.papers}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', text: paperTime, render: paperTime },
          { key: 'subjectName', label: 'Subject' },
          { key: 'examName', label: 'Exam' },
          { key: 'room', label: 'Room', render: (p) => p.room || '—' },
        ]}
      />
    </div>
  );
}

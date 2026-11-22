import { useState } from 'react';
import { addDoc, deleteDoc, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useCtx } from '../../app/AuthProvider';
import { ROLES, isAdminRole, tcol, tdoc } from '../../lib/tenant';
import { taskState, validLink } from '../../lib/calc';
import { byId, list } from '../../lib/data';
import { Alert, Badge, Button, Input, Loading, Modal, PageHeader, Select, Table, Textarea, useAction, useAsync, useConfirm, useForm } from '../../components/ui';

const STATE = { submitted: ['ok', 'Handed in'], overdue: ['bad', 'Overdue'], open: ['warn', 'Open'] };

// A link opens in a new tab and never hands the opener to the other site.
const Link = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

export default function Assignments() {
  const { role } = useCtx();
  return (
    <>
      <PageHeader title="Assignments" />
      {role === ROLES.STUDENT ? <StudentTasks /> : <StaffTasks />}
    </>
  );
}

/* ---------------- students ---------------- */

function StudentTasks() {
  const { iid, profile, today } = useCtx();
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useAsync(async () => {
    const [enrollment] = await list(query(tcol(iid, 'enrollments'), where('studentId', '==', profile.studentId), where('status', '==', 'ACTIVE')));
    if (!enrollment) return { tasks: [], mine: {}, noClass: true };
    const [tasks, mine] = await Promise.all([
      list(query(tcol(iid, 'tasks'), where('sectionId', '==', enrollment.sectionId))),
      list(query(tcol(iid, 'submissions'), where('studentId', '==', profile.studentId))),
    ]);
    return { tasks: tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate)), mine: byId(mine.map((s) => ({ ...s, id: s.taskId }))) };
  }, [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  if (data.noClass) return <Alert kind="info">You are not enrolled in a class yet.</Alert>;
  if (!data.tasks.length) return <Alert kind="info">No assignments yet.</Alert>;
  return (
    <>
      <Table
        rows={data.tasks}
        columns={[
          { key: 'title', label: 'Assignment' }, { key: 'subjectName', label: 'Subject' }, { key: 'dueDate', label: 'Due' },
          { key: 'state', label: 'Status', text: (t) => taskState(t.dueDate, today(), !!data.mine[t.id]), render: (t) => { const s = STATE[taskState(t.dueDate, today(), !!data.mine[t.id])]; return <Badge kind={s[0]}>{s[1]}</Badge>; } },
        ]}
        actions={(t) => <Button small onClick={() => setOpen(t)}>{data.mine[t.id] ? 'View' : 'Open'}</Button>}
      />
      {open && <HandIn task={open} mine={data.mine[open.id]} onClose={(saved) => { setOpen(null); if (saved) reload(); }} />}
    </>
  );
}

function HandIn({ task, mine, onClose }) {
  const { iid, profile, today } = useCtx();
  const late = task.dueDate < today();
  const { values, bind } = useForm({ url: mine?.url ?? '', note: mine?.note ?? '' });
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (late) throw new Error('The due date has passed.'); // shortcut: checked here, not in the rules; a determined student could still resubmit late
      if (!validLink(values.url)) throw new Error('Paste a full link that starts with https://');
      const name = (await getDoc(tdoc(iid, 'students', profile.studentId))).data().name;
      await setDoc(tdoc(iid, 'submissions', `${task.id}_${profile.studentId}`), {
        taskId: task.id, studentId: profile.studentId, studentName: name, url: values.url.trim(), note: values.note.trim(), submittedAt: serverTimestamp(),
      });
      onClose(true);
    });
  };
  return (
    <Modal title={task.title} onClose={() => onClose(false)}>
      <form onSubmit={submit}>
        <Alert kind="error">{error}</Alert>
        <p className="muted mt-0">{task.subjectName} · {task.facultyName} · due {task.dueDate}</p>
        {task.details && <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{task.details}</p>}
        {task.linkUrl && <p><Link href={task.linkUrl}>Open the attached material</Link></p>}
        <div className="form-grid">
          <Input label="Link to your work" type="url" required disabled={late} hint="Upload to Google Drive, share it so the teacher can view it, then paste the link here" {...bind('url')} />
          <Textarea label="Note (optional)" maxLength={500} disabled={late} {...bind('note')} />
        </div>
        {mine && <p className="muted">Last handed in: <Link href={mine.url}>your link</Link>. Saving again replaces it.</p>}
        <div className="row mt-3">
          {!late && <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : mine ? 'Replace my work' : 'Hand in'}</Button>}
          <Button onClick={() => onClose(false)}>Close</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- teachers and admins ---------------- */

function StaffTasks() {
  const { iid, profile, role } = useCtx();
  const admin = isAdminRole(role);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(
    () => list(admin ? tcol(iid, 'tasks') : query(tcol(iid, 'tasks'), where('facultyId', '==', profile.facultyId))),
    [iid],
  );
  const remove = (t) => confirm.ask(
    { title: 'Delete this assignment?', body: `${t.title}. Students' hand-ins stay in the records but can no longer be opened from here.`, label: 'Delete' },
    async () => { await deleteDoc(tdoc(iid, 'tasks', t.id)); reload(); },
  );
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  return (
    <>
      <div className="row mb-3"><Button variant="primary" onClick={() => setCreating(true)}>New assignment</Button></div>
      <Table
        rows={[...data].sort((a, b) => b.dueDate.localeCompare(a.dueDate))}
        empty="No assignments yet."
        columns={[{ key: 'title', label: 'Assignment' }, { key: 'subjectName', label: 'Subject' }, { key: 'dueDate', label: 'Due' }, ...(admin ? [{ key: 'facultyName', label: 'Teacher' }] : [])]}
        actions={(t) => (<><Button small onClick={() => setViewing(t)}>Hand-ins</Button> <Button small variant="danger" onClick={() => remove(t)}>Delete</Button></>)}
      />
      {confirm.dialog}
      {creating && <NewTask admin={admin} onClose={(saved) => { setCreating(false); if (saved) reload(); }} />}
      {viewing && <Submissions task={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function NewTask({ admin, onClose }) {
  const { iid, profile, today } = useCtx();
  const classes = useAsync(() => list(admin
    ? query(tcol(iid, 'teachingAssignments'), where('active', '==', true))
    : query(tcol(iid, 'teachingAssignments'), where('facultyId', '==', profile.facultyId), where('active', '==', true))), [iid]);
  const { values, bind } = useForm({ assignmentId: '', title: '', details: '', dueDate: '', linkUrl: '' });
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const a = byId(classes.data)[values.assignmentId];
      if (!a) throw new Error('Choose the class.');
      if (values.dueDate < today()) throw new Error('The due date cannot be in the past.');
      if (values.linkUrl.trim() && !validLink(values.linkUrl)) throw new Error('The attached link must start with https://');
      await addDoc(tcol(iid, 'tasks'), {
        assignmentId: a.id, sectionId: a.sectionId, semesterId: a.semesterId, subjectName: a.subjectName, facultyId: a.facultyId, facultyName: a.facultyName,
        title: values.title.trim(), details: values.details.trim(), dueDate: values.dueDate, linkUrl: values.linkUrl.trim() || null, createdAt: serverTimestamp(),
      });
      onClose(true);
    });
  };
  return (
    <Modal title="New assignment" onClose={() => onClose(false)}>
      <form onSubmit={submit}>
        <Alert kind="error">{error || classes.error?.message}</Alert>
        <div className="form-grid">
          <Select label="Class" required options={(classes.data ?? []).map((a) => ({ value: a.id, label: `${a.subjectName} — ${a.facultyName}` }))} {...bind('assignmentId')} />
          <Input label="Title" required maxLength={120} data-autofocus {...bind('title')} />
          <Input label="Due date" type="date" required min={today()} {...bind('dueDate')} />
          <Textarea label="Instructions (optional)" maxLength={2000} {...bind('details')} />
          <Input label="Attached material (optional)" type="url" hint="A Google Drive or Cloud Storage share link" {...bind('linkUrl')} />
        </div>
        <div className="row mt-3">
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Post assignment'}</Button>
          <Button onClick={() => onClose(false)}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function Submissions({ task, onClose }) {
  const { iid } = useCtx();
  const { data, loading, error } = useAsync(async () => {
    const [subs, roster] = await Promise.all([
      list(query(tcol(iid, 'submissions'), where('taskId', '==', task.id))),
      list(query(tcol(iid, 'enrollments'), where('sectionId', '==', task.sectionId), where('semesterId', '==', task.semesterId))),
    ]);
    const done = new Set(subs.map((s) => s.studentId));
    return { subs, missing: roster.filter((e) => e.status === 'ACTIVE' && !done.has(e.studentId)) };
  }, [task.id]);
  return (
    <Modal title={task.title} onClose={onClose}>
      {loading ? <Loading /> : error ? <Alert kind="error">{error.message}</Alert> : (
        <>
          <p className="muted mt-0">{data.subs.length} handed in{data.missing.length ? `, ${data.missing.length} not yet` : ''}. Due {task.dueDate}.</p>
          <Table
            rows={data.subs}
            empty="Nobody has handed in yet."
            columns={[
              { key: 'studentName', label: 'Student' },
              { key: 'url', label: 'Work', text: (s) => s.url, render: (s) => <Link href={s.url}>Open</Link> },
              { key: 'note', label: 'Note', render: (s) => s.note || '—' },
            ]}
          />
          {data.missing.length > 0 && <p className="muted"><strong>Not yet:</strong> {data.missing.map((e) => e.studentName).join(', ')}</p>}
        </>
      )}
      <div className="modal-actions"><Button onClick={onClose}>Close</Button></div>
    </Modal>
  );
}

import { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCtx } from '../../app/AuthProvider';
import { db } from '../../lib/firebase';
import { DEFAULT_SCALE, docRows, parseGradeScale, toCsv, validTimeZone } from '../../lib/calc';
import { list } from '../../lib/data';
import { tcol } from '../../lib/tenant';
import { Alert, Button, Facts, Input, Modal, PageHeader, downloadCsv, useAction, useForm } from '../../components/ui';

export default function Settings() {
  const { institution } = useCtx();
  const [info, setInfo] = useState(institution); // the context copy only refreshes on reload, so keep the saved values here
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState('');
  return (
    <>
      <PageHeader title="College settings">
        <Button variant="primary" onClick={() => { setSaved(''); setEditing(true); }}>Edit settings</Button>
      </PageHeader>
      <div className="card">
        <Alert kind="ok">{saved}</Alert>
        <Facts items={[['College name', info.name], ['Address', info.address], ['Contact', info.contact], ['Time zone', info.timezone], ['Grade points', info.academicSettings?.gradeScale || `${DEFAULT_SCALE.map((b) => b.join(':')).join(', ')} (default)`]]} />
      </div>
      <Backup />
      {editing && (
        <EditSettings info={info} onClose={(values) => {
          setEditing(false);
          if (values) { setInfo({ ...info, ...values }); setSaved('Saved. Reload the page to see a new time zone take effect.'); }
        }} />
      )}
    </>
  );
}

const DATASETS = [
  ['students', 'Students'], ['faculty', 'Faculty'], ['enrollments', 'Enrollments'], ['teachingAssignments', 'Teaching assignments'],
  ['subjects', 'Subjects'], ['timetableSlots', 'Timetable'], ['studentAttendance', 'Student attendance'], ['classSessions', 'Attendance registers'],
  ['exams', 'Exams'], ['examSubjects', 'Exam papers'], ['studentMarks', 'Marks'], ['results', 'Results'], ['announcements', 'Announcements'],
];

// A manual backup: every record of the college as CSV files. There are no automatic backups on the free plan.
function Backup() {
  const { iid, today } = useCtx();
  const { busy, error, run } = useAction();
  const [done, setDone] = useState('');
  const get = (name) => list(tcol(iid, name)).then((docs) => downloadCsv(`${name}-${today()}.csv`, toCsv(docRows(docs))));
  return (
    <div className="card">
      <h2>Backup</h2>
      <p className="muted mt-0">Download your college data as CSV files. There are no automatic backups, so do this once a month and keep the files somewhere safe. Each file reads every record of that kind, so avoid doing it many times a day.</p>
      <Alert kind="error">{error}</Alert>
      <Alert kind="ok">{done}</Alert>
      <div className="row">
        <Button variant="primary" disabled={busy} onClick={() => run(async () => { for (const [name] of DATASETS) await get(name); setDone(`Downloaded ${DATASETS.length} files.`); })}>{busy ? 'Downloading…' : 'Download everything'}</Button>
        {DATASETS.map(([name, label]) => <Button key={name} small disabled={busy} onClick={() => run(async () => { await get(name); setDone(`Downloaded ${label}.`); })}>{label}</Button>)}
      </div>
    </div>
  );
}

function EditSettings({ info, onClose }) {
  const { iid } = useCtx();
  const { values, bind } = useForm({
    name: info.name ?? '', address: info.address ?? '', contact: info.contact ?? '', timezone: info.timezone ?? '',
    gradeScale: info.academicSettings?.gradeScale ?? '',
  });
  const { busy, error, run } = useAction();
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      if (!validTimeZone(values.timezone.trim())) throw new Error('That is not a valid time zone name (example: Asia/Kolkata).');
      const scale = values.gradeScale.trim();
      if (scale && !parseGradeScale(scale)) throw new Error('Grade points look like 90:10, 80:9, 70:8 (a minimum percentage, a colon, the points; no repeats).');
      const { gradeScale, ...rest } = values;
      const next = { ...rest, timezone: values.timezone.trim(), academicSettings: { gradeScale: scale } };
      await updateDoc(doc(db, 'institutions', iid), { ...next, updatedAt: serverTimestamp() });
      onClose(next);
    });
  };
  return (
    <Modal title="Edit college settings" onClose={() => onClose(null)}>
      <form onSubmit={save}>
        <Alert kind="error">{error}</Alert>
        <div className="form-grid">
          <Input label="College name" required {...bind('name')} />
          <Input label="Address" {...bind('address')} />
          <Input label="Contact" {...bind('contact')} />
          <Input label="Time zone" hint="Attendance dates use this time zone" required {...bind('timezone')} />
          <Input label="Grade points" hint="Minimum percentage:points, highest first. Blank = 90:10, 80:9, 70:8, 60:7, 50:6, 40:5" {...bind('gradeScale')} />
        </div>
        <div className="row">
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

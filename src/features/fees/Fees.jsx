import { useState } from 'react';
import { doc, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCtx } from '../../app/AuthProvider';
import { isAdminRole, tcol } from '../../lib/tenant';
import { audit } from '../../lib/audit';
import { feeBalance, feeDebtors, toCsv, validAmount } from '../../lib/calc';
import { list } from '../../lib/data';
import { searchPeople } from '../../components/SearchPalette';
import { Alert, Badge, Button, Input, Loading, Modal, PageHeader, Table, downloadCsv, linkBtn, linkList, useAction, useAsync, useForm } from '../../components/ui';

const money = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

export default function Fees() {
  const { role } = useCtx();
  return isAdminRole(role) ? <AdminFees /> : <MyFees />;
}

// Entries of one student, newest first, with the totals above. Students and parents see exactly this, read-only.
function Ledger({ entries }) {
  const { charged, paid, due } = feeBalance(entries);
  const rows = [...entries].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3 phone:grid-cols-1">
        {[['Charged', money(charged), ''], ['Paid', money(paid), 'text-ok'], [due < 0 ? 'Paid ahead' : 'Due', money(Math.abs(due)), due > 0 ? 'text-bad' : 'text-ok']].map(([k, v, tone]) => (
          <div className="card m-0" key={k}><div className={`text-[28px] leading-none font-semibold tabular-nums ${tone}`}>{v}</div><div className="mt-1.5 text-xs font-medium text-muted">{k}</div></div>
        ))}
      </div>
      <Table
        rows={rows}
        empty="No fee entries yet."
        columns={[
          { key: 'date', label: 'Date' }, { key: 'title', label: 'For' },
          { key: 'type', label: 'Type', text: (r) => r.type, render: (r) => <Badge kind={r.type === 'PAYMENT' ? 'ok' : 'warn'}>{r.type === 'PAYMENT' ? 'Payment' : 'Charge'}</Badge> },
          { key: 'amount', label: 'Amount', text: (r) => String(r.amount), render: (r) => money(r.amount) },
        ]}
      />
    </>
  );
}

function MyFees() {
  const { iid, profile } = useCtx();
  const { data, loading, error } = useAsync(() => list(query(tcol(iid, 'fees'), where('studentId', '==', profile.studentId))), [iid]);
  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error.message}</Alert>;
  return (
    <>
      <PageHeader title="Fees"><Button className="print:hidden" onClick={() => window.print()}>Print</Button></PageHeader>
      <Ledger entries={data} />
      <p className="muted">Fees are recorded by the college office. To pay or to correct an entry, ask the office. Online payment is not available.</p>
    </>
  );
}

function AdminFees() {
  const { iid } = useCtx();
  const [text, setText] = useState('');
  const [found, setFound] = useState(null);
  const [student, setStudent] = useState(null);
  const [adding, setAdding] = useState(null); // 'CHARGE' | 'PAYMENT'
  const [owing, setOwing] = useState(null);
  const search = useAction();
  const ledger = useAsync(() => (student ? list(query(tcol(iid, 'fees'), where('studentId', '==', student.id))) : Promise.resolve([])), [iid, student?.id]);
  const everyone = useAction();

  const go = (e) => {
    e.preventDefault();
    if (text.trim()) search.run(async () => { setStudent(null); setFound((await searchPeople(iid, text)).students); });
  };
  // Reads every entry once, on request: the cost grows with the ledger, so it is not loaded with the page.
  const loadOwing = () => everyone.run(async () => setOwing(feeDebtors(await list(tcol(iid, 'fees')))));

  return (
    <>
      <PageHeader title="Fees">
        <Button onClick={loadOwing} disabled={everyone.busy}>{everyone.busy ? 'Loading…' : 'Who owes fees'}</Button>
      </PageHeader>
      <Alert kind="error">{everyone.error}</Alert>
      {owing && (
        <div className="card">
          <div className="mb-2 flex items-center gap-2"><h2 className="m-0 mr-auto">Outstanding fees</h2>
            <Button small disabled={!owing.length} onClick={() => downloadCsv('fees-due.csv', toCsv([['Student', 'Charged', 'Paid', 'Due'], ...owing.map((r) => [r.studentName, r.charged, r.paid, r.due])]))}>Export CSV</Button>
            <Button small onClick={() => setOwing(null)}>Close</Button></div>
          <Table rows={owing.map((r) => ({ ...r, id: r.studentId }))} empty="Nobody owes anything." columns={[
            { key: 'studentName', label: 'Student' }, { key: 'charged', label: 'Charged', render: (r) => money(r.charged) },
            { key: 'paid', label: 'Paid', render: (r) => money(r.paid) }, { key: 'due', label: 'Due', render: (r) => <Badge kind="bad">{money(r.due)}</Badge> },
          ]} />
        </div>
      )}
      <form className="row mb-3" onSubmit={go}>
        <Input label="Student name or enrollment number" value={text} onChange={setText} />
        <Button variant="primary" type="submit" disabled={search.busy || !text.trim()}>{search.busy ? 'Searching…' : 'Search'}</Button>
      </form>
      <Alert kind="error">{search.error || ledger.error?.message}</Alert>
      {found && !student && (found.length === 0 ? <p className="muted">No student found for “{text.trim()}”. Names are matched from the start.</p> : (
        <ul className={linkList} style={{ marginBottom: 16 }}>
          {found.map((s) => <li key={s.id}><button type="button" className={linkBtn} onClick={() => setStudent(s)}>{s.name} <span className="muted">{s.enrollmentNumber}</span></button></li>)}
        </ul>
      ))}
      {student && (
        <>
          <div className="row mb-3">
            <h2 className="m-0 mr-auto">{student.name} <span className="muted text-sm">{student.enrollmentNumber}</span></h2>
            <Button variant="primary" onClick={() => setAdding('CHARGE')}>Add a charge</Button>
            <Button onClick={() => setAdding('PAYMENT')}>Record a payment</Button>
            <Button onClick={() => setStudent(null)}>Change student</Button>
          </div>
          {ledger.loading ? <Loading /> : <Ledger entries={ledger.data} />}
          <p className="muted">Entries cannot be edited or deleted. To fix a mistake, add a new entry that cancels it.</p>
        </>
      )}
      {adding && <AddEntry type={adding} student={student} onClose={(saved) => { setAdding(null); if (saved) { ledger.reload(); setOwing(null); } }} />}
    </>
  );
}

function AddEntry({ type, student, onClose }) {
  const { iid, uid, today } = useCtx();
  const payment = type === 'PAYMENT';
  const { values, bind } = useForm({ title: payment ? 'Fee payment' : '', amount: '', date: today() });
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (!validAmount(values.amount)) throw new Error('Enter an amount greater than zero, with at most two decimals (for example 12000 or 12000.50).');
      const ref = doc(tcol(iid, 'fees'));
      const batch = writeBatch(db);
      const auditId = audit(batch, { iid, uid }, payment ? 'FEE_PAYMENT_RECORDED' : 'FEE_CHARGED', 'fees', ref.id, { studentId: student.id, amount: Number(values.amount) });
      batch.set(ref, { studentId: student.id, studentName: student.name, type, title: values.title.trim(), amount: Number(values.amount), date: values.date, auditId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await batch.commit();
      onClose(true);
    });
  };
  return (
    <Modal title={payment ? 'Record a payment' : 'Add a charge'} onClose={() => onClose(false)}>
      <form onSubmit={submit}>
        <Alert kind="error">{error}</Alert>
        <p className="muted mt-0">{student.name}. The entry cannot be edited afterwards.</p>
        <div className="form-grid">
          <Input label={payment ? 'Note' : 'Charge for'} required maxLength={120} hint={payment ? 'for example receipt number' : 'for example Semester 1 tuition'} data-autofocus {...bind('title')} />
          <Input label="Amount" required inputMode="decimal" {...bind('amount')} />
          <Input label="Date" type="date" required {...bind('date')} />
        </div>
        <div className="row mt-3">
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</Button>
          <Button onClick={() => onClose(false)}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchGlyph } from 'lucide-react';
import { limit, query, where } from 'firebase/firestore';
import { useCtx } from '../app/AuthProvider';
import { tcol, isAdminRole } from '../lib/tenant';
import { list } from '../lib/data';
import { Button, Input, Modal, linkList } from './ui';

const END = '';
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Prefix searches. Firestore compares exactly, so a name is tried as typed and with a capital first letter,
// and the enrollment key (stored in capitals) with the text in capitals. Five results per kind keeps reads low.
export async function searchPeople(iid, text) {
  const q = text.trim();
  const byPrefix = (col, field, prefix) =>
    list(query(tcol(iid, col), where(field, '>=', prefix), where(field, '<=', prefix + END), limit(5)));
  const variants = [...new Set([q, upperFirst(q)])];
  const [studentsByName, studentsByNumber, faculty] = await Promise.all([
    Promise.all(variants.map((v) => byPrefix('students', 'name', v))),
    byPrefix('students', 'enrollmentKey', q.toUpperCase()),
    Promise.all(variants.map((v) => byPrefix('faculty', 'name', v))),
  ]);
  const unique = (rows) => [...new Map(rows.flat().map((r) => [r.id, r])).values()].slice(0, 5);
  return {
    students: unique([...studentsByName, studentsByNumber]),
    faculty: unique(faculty),
  };
}

export default function SearchPalette({ pages }) {
  const { iid, role } = useCtx();
  const [open, setOpen] = useState(false);
  const admin = isAdminRole(role);

  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('[role=dialog]')) return; // two dialogs would close on one Escape
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" className="inline-flex min-h-10 min-w-[190px] cursor-pointer items-center gap-[9px] rounded-sm border border-field bg-card px-3 text-[12.5px] text-muted hover:border-brand hover:text-ink phone:min-w-0" onClick={() => setOpen(true)} aria-label="Search" aria-keyshortcuts="Control+K">
        <SearchGlyph size={18} />
        <span className="phone:hidden">Search</span>
        <kbd className="ml-auto rounded-[5px] border border-line px-1.5 py-px font-mono text-[11px] font-medium phone:hidden" aria-hidden="true">Ctrl K</kbd>
      </button>
      {open && <Palette iid={iid} admin={admin} pages={pages} onClose={() => setOpen(false)} />}
    </>
  );
}

function Palette({ iid, admin, pages, onClose }) {
  const [text, setText] = useState('');
  const [people, setPeople] = useState({ students: [], faculty: [] });
  const [state, setState] = useState('idle'); // idle | loading | error

  useEffect(() => {
    const q = text.trim();
    if (!admin || q.length < 2) { setPeople({ students: [], faculty: [] }); setState('idle'); return undefined; }
    let live = true;
    setState('loading');
    const t = setTimeout(() => {
      searchPeople(iid, q).then(
        (found) => { if (live) { setPeople(found); setState('idle'); } },
        () => { if (live) setState('error'); },
      );
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [text, iid, admin]);

  const needle = text.trim().toLowerCase();
  const matchingPages = pages.filter(([, label]) => !needle || label.toLowerCase().includes(needle));
  const nothing = needle.length >= 2 && state === 'idle' && !matchingPages.length && !people.students.length && !people.faculty.length;

  return (
    <Modal title="Search" onClose={onClose}>
      <Input label={admin ? 'Pages, students and faculty' : 'Pages'} value={text} onChange={setText} data-autofocus
        hint={admin ? 'Type a name, or an enrollment number from the start' : undefined} />
      {matchingPages.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[11px] font-bold tracking-[1.5px] text-muted uppercase">Pages</h3>
          <ul className={linkList}>{matchingPages.map(([to, label]) => <li key={to}><Link to={to} onClick={onClose}>{label}</Link></li>)}</ul>
        </>
      )}
      {people.students.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[11px] font-bold tracking-[1.5px] text-muted uppercase">Students</h3>
          <ul className={linkList}>{people.students.map((s) => (
            <li key={s.id}><Link to={`/students/${s.id}`} onClick={onClose}>{s.name} <span className="muted">{s.enrollmentNumber}</span></Link></li>
          ))}</ul>
        </>
      )}
      {people.faculty.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-[11px] font-bold tracking-[1.5px] text-muted uppercase">Faculty</h3>
          <ul className={linkList}>{people.faculty.map((f) => (
            <li key={f.id}><Link to={`/faculty/${f.id}`} onClick={onClose}>{f.name} <span className="muted">{f.designation}</span></Link></li>
          ))}</ul>
        </>
      )}
      {state === 'loading' && <p className="muted" role="status">Searching…</p>}
      {state === 'error' && <p className="muted" role="alert">The search failed. Try again.</p>}
      {nothing && <p className="muted" role="status">Nothing found for “{text.trim()}”.</p>}
      <div className="modal-actions"><Button onClick={onClose}>Close</Button></div>
    </Modal>
  );
}

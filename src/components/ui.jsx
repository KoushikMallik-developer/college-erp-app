import { Inbox } from 'lucide-react';
import { useLive } from '../lib/liveContext';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';

export function Button({ variant, small, className = '', ...props }) {
  return <button type="button" className={`btn ${variant ?? ''} ${small ? 'sm' : ''} ${className}`} {...props} />;
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Input({ label, hint, value, onChange, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function Select({ label, hint, value, onChange, options, placeholder = 'Select…', ...rest }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function Textarea({ label, value, onChange, ...rest }) {
  return (
    <Field label={label}>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

// Success messages pop up as a toast and fade away; errors and info stay where they are.
export function Alert({ kind = 'info', children }) {
  const toast = useToast();
  const text = kind === 'ok' && typeof children === 'string' ? children : '';
  useEffect(() => { if (text) toast(text); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!children || text) return null;
  return <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text) => {
    const id = crypto.randomUUID();
    setItems((all) => [...all.slice(-3), { id, text }]);
    setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setItems((all) => all.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const Badge = ({ kind, children }) => <span className={`badge ${kind ?? ''}`}>{children}</span>;

// Grey placeholder shapes; the text stays for screen readers.
export const Loading = ({ text = 'Loading…' }) => (
  <div className="skeleton" role="status"><span className="sr-only">{text}</span><i /><i /><i /></div>
);

export function PageHeader({ title, children }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, wide, children }) {
  const titleId = useId();
  const ref = useRef();
  // Callers pass a new onClose every render; a ref keeps the effect from re-running (and stealing focus) on each keystroke.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    (ref.current.querySelector('[data-autofocus]') ?? ref.current).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') return close.current();
      if (e.key !== 'Tab') return;
      const items = [...ref.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
      if (!items.length) return;
      const at = document.activeElement;
      if (e.shiftKey && (at === items[0] || at === ref.current)) { e.preventDefault(); items.at(-1).focus(); }
      else if (!e.shiftKey && at === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, []);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Read-only details; edits happen in a modal. items: [[label, value]]
export const Facts = ({ items }) => (
  <dl className="facts">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
);

// Asks first, then runs the action. Render `dialog` once in the screen: ask({ title, body, label, danger }, fn).
export function useConfirm() {
  const [req, setReq] = useState(null);
  const ask = (opts, fn) => setReq({ ...opts, fn });
  const close = () => setReq(null);
  const dialog = req && (
    <Modal title={req.title} onClose={close}>
      {req.body && <p className="muted">{req.body}</p>}
      <div className="modal-actions">
        <Button onClick={close}>Cancel</Button>
        <Button variant={req.danger === false ? 'primary' : 'danger'} onClick={() => { close(); req.fn(); }}>{req.label ?? 'Confirm'}</Button>
      </div>
    </Modal>
  );
  return { ask, dialog };
}

const SIZES = [10, 25, 50, 100];
const plainValue = (v) => (typeof v === 'string' || typeof v === 'number' ? v : undefined);
// What to sort and search a column by: its text(row) if it has one, else the stored value unless render changes what is shown.
const valueOf = (c, r) => (c.text ? c.text(r) : c.render ? undefined : plainValue(r[c.key]));

// columns: [{ key, label, render?, text? }]. Click a heading to sort; long lists get a filter box and pages.
// A column with render shows something other than the stored value, so it is sorted and searched only if it gives text(row).
// plain: no sorting, filter or pages (forms inside rows, such as registers, must show every row).
// rows is undefined when the load failed; the screen shows the error above, so draw an empty table, not a crash.
export function Empty({ children }) {
  return <div className="empty-state"><Inbox size={28} /><p>{children}</p></div>;
}

export function Table({ columns, rows = [], empty = 'Nothing here yet.', actions, plain }) {
  const [sort, setSort] = useState({ key: '', dir: 1 });
  const [text, setText] = useState('');
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(0);
  const shown = useMemo(() => {
    if (plain) return rows;
    const q = text.trim().toLowerCase();
    let out = q ? rows.filter((r) => columns.some((c) => String(valueOf(c, r) ?? '').toLowerCase().includes(q))) : rows;
    const col = columns.find((c) => c.key === sort.key); // gone if the columns changed since the click
    if (col) {
      out = [...out].sort((a, b) => {
        const x = valueOf(col, a), y = valueOf(col, b);
        if (x === undefined || y === undefined) return (x === undefined) - (y === undefined);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      });
    }
    return out;
  }, [rows, columns, text, sort, plain]);
  if (!rows.length) return <Empty>{empty}</Empty>;

  const last = Math.max(0, Math.ceil(shown.length / size) - 1);
  const at = Math.min(page, last);
  const visible = plain ? shown : shown.slice(at * size, at * size + size);
  const sortable = (c) => !plain && rows.some((r) => valueOf(c, r) !== undefined);
  const flip = (key) => { setSort((v) => ({ key, dir: v.key === key ? -v.dir : 1 })); setPage(0); };
  return (
    <>
      {!plain && (rows.length > 10 || text) && columns.some(sortable) && ( // kept while it holds text, so a live reload that shrinks the list cannot leave a hidden filter on
        <input className="table-filter" type="search" placeholder="Filter rows…" aria-label="Filter rows" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} />
      )}
      <div className="table-wrap">
        <table className="stack">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {sortable(c) ? (
                    <button type="button" className="th-sort" onClick={() => flip(c.key)}>{c.label}<span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span></button>
                  ) : c.label}
                </th>
              ))}
              {actions && <th scope="col"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id ?? JSON.stringify(r)}>
                {columns.map((c) => <td key={c.key} data-label={c.label}>{c.render ? c.render(r) : r[c.key]}</td>)}
                {actions && <td className="actions">{actions(r)}</td>}
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="muted">Nothing matches “{text}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {!plain && shown.length > Math.min(...SIZES) && (
        <div className="pager">
          <span className="muted">{shown.length ? `${at * size + 1}–${Math.min(shown.length, at * size + size)} of ${shown.length}` : '0 rows'}</span>
          <select aria-label="Rows per page" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
            {SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <Button small disabled={at === 0} onClick={() => setPage(at - 1)}>Previous</Button>
          <Button small disabled={at >= last} onClick={() => setPage(at + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}

// Runs an async function and tracks loading, error and result.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const live = useLive();
  const prev = useRef(null);
  useEffect(() => {
    let current = true;
    // Same inputs as last time and only the college changed: reload quietly, keep what is on screen.
    const inputs = [...deps, tick];
    const quiet = prev.current !== null && inputs.length === prev.current.length && inputs.every((x, i) => Object.is(x, prev.current[i]));
    prev.current = inputs;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => current && setState({ data, loading: false, error: null }),
      (error) => current && (quiet ? undefined : setState({ data: undefined, loading: false, error })),
    );
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, live]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// Wraps a submit handler with a busy flag and an error message.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const run = useCallback(async (fn, successMessage = '') => {
    setBusy(true); setError(''); setDone('');
    try {
      const result = await fn();
      setDone(successMessage);
      return result;
    } catch (e) {
      setError(friendly(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, done, run };
}

export function friendly(e) {
  const code = e?.code ?? '';
  if (code === 'permission-denied') return 'You are not allowed to do that (or the college is suspended).';
  if (code === 'auth/email-already-in-use') return 'That email already has an account. Ask the platform admin to free it if it belongs to another college.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Wrong email or password.';
  if (code === 'resource-exhausted') return 'The free daily quota is used up. Try again after it resets.';
  return e?.message ?? String(e);
}

export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (name) => ({ value: values[name], onChange: (v) => setValues((s) => ({ ...s, [name]: v })) });
  return { values, bind, set: setValues };
}

export const toOptions = (docs, label = 'name') => docs.map((d) => ({ value: d.id, label: d[label] ?? d.id }));

export function downloadCsv(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

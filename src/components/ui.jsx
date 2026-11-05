import { Inbox } from 'lucide-react';
import { useLive } from '../lib/liveContext';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';

// Class strings used by more than one component live here once. Pairs that would fight over one property are kept apart (a size or a look, never both).
export const iconBtnBase = 'relative inline-grid size-10 flex-none place-items-center rounded-sm border-0 bg-transparent cursor-pointer motion-safe:transition phone:size-11 print:hidden';
export const iconBtn = `${iconBtnBase} text-muted hover:bg-soft hover:text-ink`;
export const fieldCls = 'grid flex-1 min-w-[170px] content-start gap-[7px] text-[13px] font-semibold text-muted';
export const hintCls = 'text-xs font-normal text-muted';
export const checkCls = 'my-3 flex items-center gap-2.5 font-medium';
export const linkList = 'mx-0 mt-1 mb-0 grid list-none gap-1.5 p-0 [&_a]:block [&_a]:rounded-sm [&_a]:bg-soft [&_a]:px-3.5 [&_a]:py-[11px] [&_a]:text-[13px] [&_a]:font-semibold [&_a]:text-ink [&_a]:no-underline [&_a]:hover:bg-brand-soft [&_a]:hover:text-brand-deep';
export const agendaList = 'mx-0 mt-0 mb-3 grid list-none gap-2 p-0 [&>li]:flex [&>li]:flex-wrap [&>li]:items-baseline [&>li]:gap-2';
export const agendaDate = 'min-w-[9.5rem] text-xs text-muted';
export const linkBtn = 'cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-brand-deep hover:underline';

const BTN = 'inline-flex items-center justify-center gap-2 rounded-sm border font-semibold cursor-pointer motion-safe:transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 print:hidden';
const BTN_SIZE = { false: 'min-h-10 px-4 py-2 text-[13.5px]', true: 'min-h-8 px-3 py-[5px] text-xs phone:min-h-11' };
const BTN_LOOK = {
  default: 'border-line bg-card text-ink hover:bg-soft',
  primary: 'border-brand bg-brand text-brand-ink hover:brightness-[.92]',
  danger: 'border-bad-soft bg-card text-bad hover:border-bad hover:bg-bad-soft',
};

export function Button({ variant, small, className = '', ...props }) {
  return <button type="button" className={`${BTN} ${BTN_SIZE[!!small]} ${BTN_LOOK[variant] ?? BTN_LOOK.default} ${className}`} {...props} />;
}

export function Field({ label, hint, children }) {
  return (
    <label className={fieldCls}>
      <span>{label}</span>
      {children}
      {hint && <span className={hintCls}>{hint}</span>}
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

const ALERT = {
  error: 'border-bad/30 bg-bad-soft text-bad',
  ok: 'border-ok/30 bg-ok-soft text-ok',
  info: 'border-brand/20 bg-brand-soft text-brand-deep',
};

// Success messages pop up as a toast and fade away; errors and info stay where they are.
export function Alert({ kind = 'info', children }) {
  const toast = useToast();
  const text = kind === 'ok' && typeof children === 'string' ? children : '';
  useEffect(() => { if (text) toast(text); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!children || text) return null;
  return <div className={`mb-4 rounded-sm border px-4 py-3 text-[13.5px] font-medium ${ALERT[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
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
      <div className="fixed right-6 bottom-6 z-(--z-toast) grid max-w-[calc(100%-32px)] gap-2.5 phone:right-4 phone:bottom-[76px] print:hidden" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="flex items-center gap-3 rounded-[10px] border border-panel-line bg-panel-2 py-2.5 pr-2 pl-[18px] text-[13px] text-white shadow-[0_8px_30px_var(--shade)]" key={t.id}>
            <span>{t.text}</span>
            <button type="button" className="inline-grid size-[30px] flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-xl text-blue-100 hover:bg-white/10 hover:text-white phone:size-11" aria-label="Dismiss" onClick={() => setItems((all) => all.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const BADGE = {
  ok: 'border-ok/25 bg-ok-soft text-ok',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  bad: 'border-bad/25 bg-bad-soft text-bad',
};
// "badge" is also a hook for the phone table card rule in app.css.
export const Badge = ({ kind, children }) => (
  <span className={`badge inline-flex items-center rounded-[6px] border px-[9px] py-[3px] text-[11px] font-semibold ${BADGE[kind] ?? 'border-line bg-soft text-muted'}`}>{children}</span>
);

// Grey placeholder shapes; the text stays for screen readers.
const BAR = 'block rounded-[6px] bg-[linear-gradient(90deg,var(--soft)_25%,var(--line)_50%,var(--soft)_75%)] bg-[length:200%_100%] motion-safe:animate-shimmer';
export const Loading = ({ text = 'Loading…' }) => (
  <div className="grid gap-3 py-2" role="status">
    <span className="sr-only">{text}</span>
    <i className={`${BAR} h-7 w-2/5`} /><i className={`${BAR} h-[18px]`} /><i className={`${BAR} h-[18px] w-[70%]`} />
  </div>
);

// For the whole screen loading (signing in, first load). Parts of a page use the grey Loading shapes above instead.
export const Spinner = ({ text = 'Loading…' }) => (
  <div className="grid min-h-dvh place-items-center bg-page" role="status">
    <span className="size-10 rounded-full border-4 border-line border-t-brand motion-safe:animate-spin" />
    <span className="sr-only">{text}</span>
  </div>
);

export function PageHeader({ title, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-6 border-b border-line print:hidden" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-[3px] py-3 text-[13px] font-medium text-muted hover:text-ink aria-selected:border-brand aria-selected:font-[650] aria-selected:text-brand-deep">
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
    <div className="fixed inset-0 z-(--z-modal) grid place-items-center bg-scrim p-4 backdrop-blur-[4px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`max-h-[88dvh] overflow-y-auto rounded-lg border border-line bg-card p-7 text-ink shadow-[0_30px_90px_var(--shade)] [&>p]:mt-0 [&>p]:mb-2 [&_form>.row:last-child]:mt-[18px] [&_form>.row:last-child]:justify-end [&_td_input[type=number]]:w-22 ${wide ? 'w-[min(980px,100%)]' : 'w-[min(560px,100%)]'}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId} className="mb-2 text-2xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Read-only details; edits happen in a modal. items: [[label, value]]
export const Facts = ({ items }) => (
  <dl className="mx-0 mt-0 mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-x-6 gap-y-4">
    {items.map(([k, v]) => (
      <div key={k}>
        <dt className="text-[11px] font-semibold tracking-[.5px] text-muted uppercase">{k}</dt>
        <dd className="mx-0 mt-[3px] mb-0 font-medium [overflow-wrap:anywhere]">{v || '—'}</dd>
      </div>
    ))}
  </dl>
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
  return <div className="grid justify-items-center gap-2 rounded-md border border-dashed border-field bg-card px-4 py-10 text-center text-muted"><Inbox size={28} /><p className="m-0">{children}</p></div>;
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
        <input className="mb-3 max-w-[320px]" type="search" placeholder="Filter rows…" aria-label="Filter rows" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} />
      )}
      <div className="table-wrap">
        <table className="stack">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {sortable(c) ? (
                    <button type="button" className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-inherit [letter-spacing:inherit] [text-transform:inherit] hover:text-ink focus-visible:rounded-[4px] focus-visible:outline-offset-2" onClick={() => flip(c.key)}>{c.label}<span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span></button>
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
                {actions && <td className="text-right whitespace-nowrap phone:mt-1 phone:flex phone:flex-wrap phone:justify-start phone:gap-2 phone:border-t phone:border-line phone:pt-3 phone:whitespace-normal">{actions(r)}</td>}
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="muted">Nothing matches “{text}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {!plain && shown.length > Math.min(...SIZES) && (
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-0.5 py-3">
          <span className="muted mr-auto">{shown.length ? `${at * size + 1}–${Math.min(shown.length, at * size + size)} of ${shown.length}` : '0 rows'}</span>
          <select aria-label="Rows per page" className="min-h-8 w-auto py-1 pr-7 pl-2 text-xs [background-position:calc(100%-14px)_50%,calc(100%-9px)_50%]" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
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

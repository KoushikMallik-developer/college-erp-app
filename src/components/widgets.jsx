import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { iconBtn } from './ui';

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Light or dark. The choice is saved on this device; index.html applies it before the page paints.
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || systemTheme());
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* storage blocked: the choice lasts until reload */ }
    setTheme(next);
  };
  return (
    <button type="button" className={iconBtn} onClick={flip} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

// Shown while the browser is offline: the app shell still opens, but saving needs a connection.
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online ? null : <div className="mb-4 rounded-sm border border-warn bg-warn-soft px-3.5 py-2.5 font-semibold text-warn print:hidden" role="status">You are offline. Saving and loading will work again when you reconnect.</div>;
}

// A progress ring: value 0-100, null while there is nothing to show yet.
const RING_STROKE = { great: 'stroke-ok', low: 'stroke-bad' };

export function Ring({ value, label }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = value ?? 0;
  const tone = value === null ? 'none' : value >= 90 ? 'great' : value >= 75 ? 'ok' : 'low';
  return (
    <div className="relative size-[140px] flex-none" role="img" aria-label={`${label}: ${value === null ? 'no data yet' : `${value} percent`}`}>
      <svg className="size-full" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-line stroke-12" />
        <circle cx="60" cy="60" r={r} className={`fill-none stroke-12 [stroke-linecap:round] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(.2,.8,.2,1)] ${RING_STROKE[tone] ?? 'stroke-brand'}`} strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[28px] font-semibold tracking-[-1px]">{value === null ? '—' : `${Math.round(value)}%`}</div>
    </div>
  );
}

// The Techomato mascot (a round blue character with a leaf), for the student pages.
export function Mascot({ size = 64, mood = 'happy' }) {
  const mouth = mood === 'worried' ? 'M12 28c2-2 8-2 10 0' : 'M11.5 25.5c2 3.2 9 3.2 11 0';
  return (
    <svg className="origin-[50%_90%] motion-safe:animate-wobble" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="19" r="14" fill="var(--brand)" />
      <path d="M13 5c2 2 6 2 8 0" stroke="var(--leaf)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="12.5" cy="17.5" r="1.7" fill="#fff" /><circle cx="21.5" cy="17.5" r="1.7" fill="#fff" />
      <circle cx="12.9" cy="17.8" r=".8" fill="#17181c" /><circle cx="21.9" cy="17.8" r=".8" fill="#17181c" />
      <path d={mouth} stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const greeting = (hour = new Date().getHours()) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

// Red under 75%, grey when there is no data, solid for today, a softer brand colour for other days.
const barColor = (b) => (b.pct !== null && b.pct < 75 ? 'bg-bad' : b.pct === null ? 'bg-line' : b.now ? 'bg-brand' : 'bg-[color-mix(in_srgb,var(--brand)_55%,var(--card))]');

// A bar chart of percentages. items: [{ key, label, pct (null = no data), now?, title? }]
export function Bars({ items, ariaLabel }) {
  return (
    <div className="mt-[18px] flex h-[190px] gap-2.5" role="img" aria-label={ariaLabel}>
      {items.map((b) => (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" key={b.key} title={b.title ?? `${b.label}: ${b.pct === null ? 'no data' : `${b.pct}%`}`}>
          <span className="h-4 text-[11px] font-semibold tabular-nums">{b.pct === null ? '' : `${Math.round(b.pct)}%`}</span>
          <div className="flex w-full max-w-10 flex-1 items-end rounded-t-[6px] bg-soft"><div className={`min-h-0.5 w-full rounded-t-[6px] ${barColor(b)}`} style={{ height: `${b.pct ?? 2}%` }} /></div>
          <span className="max-w-full truncate text-[11px] text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

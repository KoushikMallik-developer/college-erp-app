import { Link } from 'react-router-dom';
import { useCtx } from '../../app/AuthProvider';
import BrandMark from '../../components/BrandMark';
import { ThemeToggle } from '../../components/widgets';

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL;

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const FEATURES = [
  {
    title: 'Attendance in a few taps',
    text: 'Teachers open their class, mark Present, Absent or Leave, and save. Students see their own percentage the same day.',
    icon: <path d="M20 6 9 17l-5-5" />,
  },
  {
    title: 'A timetable that cannot clash',
    text: 'A room, a teacher or a section can only be in one place per period. A double booking is refused when you save it.',
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  },
  {
    title: 'Exams and results you can trust',
    text: 'Results stay hidden until you publish. Publishing waits for every mark, so nobody sees a half-finished result.',
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  },
  {
    title: 'Class materials in one place',
    text: 'Teachers share notes with the class they teach. Only students enrolled in that class can open them.',
    icon: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  },
  {
    title: 'Every college kept apart',
    text: 'Many colleges can use the same system and never see each other. Each one has its own students, staff and records.',
    icon: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  },
  {
    title: 'A record of every change',
    text: 'When a mark or an attendance entry is corrected, the system keeps who changed it, and from what to what.',
    icon: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
  },
];

const STEPS = [
  ['Set up your college', 'Add departments, courses, subjects, sections, teachers and students once.'],
  ['Teachers do the daily work', 'They mark attendance, enter marks and share notes, only for the classes they teach.'],
  ['Everyone sees what is theirs', 'Students check their attendance and published results. Admins see the whole college.'],
];

const ROLES = [
  ['College admins', 'Run the college: people, classes, timetable, exams, announcements and reports.'],
  ['Faculty', 'Open their classes, mark attendance, enter marks and upload notes. Nothing else.'],
  ['Students', 'See their own timetable, attendance, class notes and results once published.'],
];

const TRUST = [
  'Students see only their own records.',
  'Teachers can change only the classes they teach.',
  'Results are hidden until an admin publishes them.',
  'Every correction to attendance or marks is logged.',
];

// Class strings the page repeats. Pairs that fight over one property (a size, a look) are kept apart so the result never depends on stylesheet order.
const WRAP = 'mx-auto w-[min(1120px,100%_-_2.5rem)]';
const SECTION = 'py-[5.5rem] tiny:py-14';
const CARD = 'rounded-md border border-line bg-card p-[1.6rem] motion-safe:transition duration-200 hover:-translate-y-[3px] hover:border-brand hover:shadow-[0_18px_36px_-22px_var(--shade)]';
const H2 = 'text-[clamp(1.8rem,3.4vw,2.7rem)]';
const SUB = 'mt-4 max-w-[38rem] text-[1.1rem] leading-[1.6]';
const BTN = 'inline-flex items-center justify-center rounded-full border-[1.5px] font-semibold no-underline motion-safe:transition duration-150';
const BTN_SIZE = { false: 'min-h-12 px-[1.4rem] py-[.6rem]', true: 'min-h-10 px-[1.1rem] py-[.35rem]' };
const BTN_LOOK = {
  solid: 'border-transparent bg-brand text-brand-ink shadow-[0_8px_20px_-8px_var(--glow)] hover:-translate-y-px hover:shadow-[0_12px_26px_-8px_var(--glow)]',
  ghost: 'border-line bg-transparent text-ink hover:border-ink hover:bg-soft',
};
const btn = (look, small = false) => `${BTN} ${BTN_SIZE[small]} ${BTN_LOOK[look]}`;
const CHIP = { P: 'bg-ok-soft text-ok', A: 'bg-bad-soft text-bad', L: 'bg-warn-soft text-warn' };

function Register() {
  const rows = [['Aarav', 'P'], ['Diya', 'P'], ['Kabir', 'A'], ['Meera', 'L']];
  return (
    <div className="relative pt-4 pb-36 motion-safe:animate-rise [animation-delay:.2s] tiny:pb-4" role="img" aria-label="Illustration: a class attendance register and a published result card, with sample data">
      <div className="ml-auto max-w-[26rem] rounded-lg border border-line bg-card px-[1.2rem] pt-[1.1rem] pb-[1.2rem] shadow-[0_30px_60px_-28px_var(--shade),0_4px_10px_var(--shade)] narrow:mx-auto" aria-hidden="true">
        <div className="flex justify-between gap-4 border-b border-line pb-[.8rem] text-[.9rem]">
          <strong>Mathematics</strong>
          <span className="text-muted">Section A · Period 2</span>
        </div>
        {rows.map(([name, status]) => (
          <div className="flex items-center gap-3 border-b border-line py-[.65rem]" key={name}>
            <span className="grid size-[34px] place-items-center rounded-full bg-brand-soft font-bold text-brand-deep">{name[0]}</span>
            <span className="flex-1 font-medium">{name}</span>
            <span className={`rounded-full px-[.7rem] py-1 text-[.8rem] font-semibold ${CHIP[status]}`}>{{ P: 'Present', A: 'Absent', L: 'Leave' }[status]}</span>
          </div>
        ))}
        <div className="mt-4 rounded-full bg-brand p-[.7rem] text-center font-semibold text-brand-ink">Save attendance</div>
      </div>
      <div className="absolute bottom-[.6rem] -left-[1.2rem] w-[11.5rem] rounded-lg border border-line bg-card px-[1.1rem] py-4 shadow-[0_30px_60px_-28px_var(--shade),0_4px_10px_var(--shade)] motion-safe:animate-float narrow:left-0 tiny:static tiny:mx-auto tiny:mt-4 tiny:animate-none" aria-hidden="true">
        <span className="inline-block rounded-full bg-ok-soft px-[.6rem] py-[.2rem] text-xs font-semibold text-ok">Published</span>
        <div className="mt-[.4rem] text-[2.4rem] font-bold tracking-[-0.03em]">78%</div>
        <div className="text-[.85rem] text-muted">Mid-term · Pass</div>
        <div className="mt-[.7rem] h-2 overflow-hidden rounded-full bg-line"><span className="block h-full w-[78%] bg-ok" /></div>
      </div>
      <p className="absolute right-0 bottom-0 text-xs text-muted tiny:static tiny:mt-2 tiny:text-center" aria-hidden="true">Sample data</p>
    </div>
  );
}

export default function Landing() {
  const ctx = useCtx();
  const [to, label] = ctx?.user && ctx?.profile ? ['/dashboard', 'Open dashboard'] : ['/login', 'Sign in'];
  const navLink = 'py-2 font-medium text-muted no-underline hover:text-brand';
  return (
    <div className="lp bg-page font-sans text-ink">
      <a className="absolute top-0 -left-[999px] z-(--z-skip) rounded-br-[8px] bg-brand px-4 py-[.6rem] text-brand-ink focus:left-0" href="#main">Skip to content</a>
      <header className="sticky top-0 z-(--z-topbar) border-b border-line bg-page/88 backdrop-blur-[10px]">
        <div className={`${WRAP} flex min-h-16 items-center gap-6`}>
          <Link to="/" className="mr-auto flex items-center gap-[.6rem] text-[1.1rem] font-extrabold tracking-[-.02em] no-underline tiny:text-[.95rem]"><BrandMark size={30} /> Techomato Colleges</Link>
          <nav aria-label="Page sections" className="flex gap-6 narrow:hidden">
            <a className={navLink} href="#features">Features</a>
            <a className={navLink} href="#how">How it works</a>
            <a className={navLink} href="#roles">Who it is for</a>
          </nav>
          <ThemeToggle />
          <Link to={to} className={btn('solid', true)}>{label}</Link>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden bg-page bg-[radial-gradient(60rem_28rem_at_85%_-10%,var(--brand-soft)_0%,transparent_60%),radial-gradient(40rem_24rem_at_-5%_20%,var(--soft)_0%,transparent_60%)] pt-20 pb-18 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] before:bg-[length:48px_48px] before:opacity-50 before:[mask-image:radial-gradient(ellipse_at_70%_30%,var(--black)_0%,transparent_70%)] before:content-[''] tiny:py-12">
          <div className={`${WRAP} relative grid grid-cols-[1.05fr_.95fr] items-center gap-12 narrow:grid-cols-1`}>
            <div className="[&>*]:motion-safe:animate-rise [&>:nth-child(2)]:[animation-delay:.08s] [&>:nth-child(3)]:[animation-delay:.16s] [&>:nth-child(4)]:[animation-delay:.24s] [&>:nth-child(5)]:[animation-delay:.32s]">
              <p className="mb-5 inline-block rounded-full bg-brand-soft px-[.8rem] py-[.35rem] text-[.85rem] font-semibold text-brand-deep">College management, without the spreadsheets</p>
              <h1 className="text-[clamp(2.4rem,5.2vw,4rem)]">One calm place to run your <em className="text-brand not-italic">whole college</em>.</h1>
              <p className="mt-[1.4rem] max-w-[34rem] text-[1.15rem] leading-[1.65] text-muted">
                Attendance, timetables, exams, results and class notes for every teacher, student and admin. Built to
                replace paper registers and scattered files, and simple enough to use on day one.
              </p>
              <div className="mt-8 flex flex-wrap gap-[.8rem] tiny:[&>a]:w-full">
                <Link to={to} className={btn('solid')}>{ctx?.user && ctx?.profile ? label : 'Sign in to your college'}</Link>
                {CONTACT
                  ? <a href={`mailto:${CONTACT}`} className={btn('ghost')}>Contact us</a>
                  : <a href="#features" className={btn('ghost')}>See what it does</a>}
              </div>
              <ul className="mt-[1.8rem] flex flex-wrap gap-x-[1.6rem] gap-y-2 text-[.95rem] text-muted [&>li]:before:mr-[.55rem] [&>li]:before:inline-block [&>li]:before:size-2 [&>li]:before:rounded-full [&>li]:before:bg-ok [&>li]:before:content-['']">
                <li>Works on a phone, tablet or computer</li>
                <li>Each college's data stays separate</li>
              </ul>
            </div>
            <Register />
          </div>
        </section>

        <section id="features" className={SECTION}>
          <div className={WRAP}>
            <h2 className={`${H2} text-center`}>Everything a college runs on, in one system</h2>
            <p className={`${SUB} mx-auto text-center text-muted`}>Six things that take the most time every week, done properly.</p>
            <ul className="mt-12 grid grid-cols-3 gap-5 narrow:grid-cols-2 tiny:grid-cols-1">
              {FEATURES.map((f) => (
                <li className={CARD} key={f.title}>
                  <span className="mb-4 grid size-12 place-items-center rounded-[14px] bg-brand-soft text-brand-deep"><Icon>{f.icon}</Icon></span>
                  <h3 className="mb-2 text-[1.15rem]">{f.title}</h3>
                  <p className="leading-[1.6] text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className={`${SECTION} bg-soft`}>
          <div className={WRAP}>
            <h2 className={`${H2} text-center`}>Up and running in three steps</h2>
            <ol className="mt-12 grid grid-cols-3 gap-8 narrow:grid-cols-1">
              {STEPS.map(([title, text], i) => (
                <li className="relative pt-4" key={title}>
                  <span className="mb-4 grid size-11 place-items-center rounded-full bg-brand font-bold text-brand-ink" aria-hidden="true">{i + 1}</span>
                  <h3 className="mb-2 text-[1.2rem]">{title}</h3>
                  <p className="leading-[1.6] text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className={SECTION}>
          <div className={WRAP}>
            <h2 className={`${H2} text-center`}>Made for the people who use it every day</h2>
            <ul className="mt-10 grid grid-cols-3 gap-5 narrow:grid-cols-2 tiny:grid-cols-1">
              {ROLES.map(([title, text]) => (
                <li className={CARD} key={title}>
                  <h3 className="mb-2 text-[1.15rem]">{title}</h3>
                  <p className="leading-[1.6] text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${SECTION} bg-panel bg-[radial-gradient(40rem_20rem_at_90%_0%,var(--glow)_0%,transparent_60%)] text-panel-text`}>
          <div className={`${WRAP} grid grid-cols-2 items-center gap-12 narrow:grid-cols-1`}>
            <div>
              <h2 className={H2}>Careful with what matters</h2>
              <p className={`${SUB} text-panel-muted`}>Marks and attendance decide real outcomes. The system is built so that mistakes are hard to make and easy to trace.</p>
            </div>
            <ul className="grid gap-[.9rem]">
              {TRUST.map((t) => (
                <li className="flex items-start gap-[.8rem] rounded-[14px] border border-white/12 bg-white/7 px-[1.2rem] py-4 font-medium" key={t}>
                  <svg className="mt-px flex-none text-green-300" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${SECTION} bg-[linear-gradient(var(--bg),var(--soft))] text-center`}>
          <div className={WRAP}>
            <h2 className={H2}>Ready when you are</h2>
            <p className={`${SUB} mx-auto text-muted`}>Your college admin gives you your login. Sign in to get started.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-[.8rem] tiny:[&>a]:w-full">
              <Link to={to} className={btn('solid')}>{label}</Link>
              {CONTACT && <a href={`mailto:${CONTACT}`} className={btn('ghost')}>Contact us</a>}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-[1.6rem] text-[.95rem] text-muted">
        <div className={`${WRAP} flex flex-wrap justify-between gap-4`}>
          <span>© {new Date().getFullYear()} Techomato Colleges</span>
          <Link className="font-semibold text-brand-deep no-underline" to={to}>{label}</Link>
        </div>
      </footer>
    </div>
  );
}

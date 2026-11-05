import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Alert, Button, Input, useAction } from '../../components/ui';
import { useCtx } from '../../app/AuthProvider';
import BrandMark from '../../components/BrandMark';
import { ThemeToggle } from '../../components/widgets';
import { loginEmail } from '../../lib/calc';

export default function Login() {
  const { error: accountError } = useCtx();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, done, run } = useAction();

  const submit = (e) => {
    e.preventDefault();
    run(() => signInWithEmailAndPassword(auth, loginEmail(email), password));
  };
  const reset = () =>
    run(() => sendPasswordResetEmail(auth, loginEmail(email)),'If that email has an account, a reset link is on its way.');

  return (
    <div className="grid min-h-svh place-items-center bg-page p-8 mid:p-6 phone:p-4">
      <div className="grid min-h-[680px] w-[min(1100px,100%)] grid-cols-2 overflow-hidden rounded-[30px] border border-line bg-card shadow-[0_24px_60px_color-mix(in_srgb,var(--slate-900)_9%,transparent),0_3px_10px_color-mix(in_srgb,var(--slate-900)_2%,transparent)] phone:max-w-[460px] phone:min-h-0 phone:grid-cols-1 phone:rounded-3xl">
        <main className="flex items-center justify-center p-[54px] mid:px-8 mid:py-10 phone:px-6 phone:py-8">
          <div className="w-full max-w-[390px]">
            <div className="mb-[34px] flex items-center justify-between">
              <Link className="flex items-center gap-[11px] text-[22px] font-bold tracking-[-.8px] text-ink no-underline" to="/"><BrandMark size={36} />Techomato Colleges</Link>
              <ThemeToggle />
            </div>
            <header><h1 className="text-[29px] tracking-[-1px]">Welcome back.</h1><p className="mt-[7px] mb-0 text-[13px] text-muted">Sign in with the email your college gave you.</p></header>
            <div className="mt-6 mb-[22px] flex items-center justify-between rounded-3xl bg-brand-soft px-3.5 py-[11px] text-xs font-semibold text-brand-deep"><span>Sign in to your account</span><ShieldCheck size={16} /></div>
            <Alert kind="error">{error || accountError}</Alert>
            <Alert kind="ok">{done}</Alert>
            <form onSubmit={submit} className="grid gap-[18px] [&_input]:rounded-md [&_input]:border-line [&_input]:bg-soft [&_input]:px-[15px] [&_input]:py-[13px] [&_input]:text-[13px] [&_input:focus]:bg-card [&_label]:min-w-0 [&_label]:text-xs [&_button]:min-h-[46px] [&_button]:rounded-md [&_button.bg-brand]:shadow-[0_5px_12px_var(--glow)]">
              <Input label="Email or username" autoComplete="username" required value={email} onChange={setEmail} />
              <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={setPassword} />
              <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></Button>
              <Button onClick={reset} disabled={busy || !email}>Forgot password? Email me a reset link</Button>
            </form>
            <p className="mt-2 text-[11px] leading-[1.7] text-muted"><Link to="/">← Back to home</Link></p>
          </div>
        </main>
        <aside className="relative isolate flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_85%_10%,var(--blue-300)_0%,transparent_45%),radial-gradient(ellipse_at_10%_70%,var(--blue-400)_0%,transparent_50%),linear-gradient(155deg,var(--blue-900),var(--navy-800)_80%)] p-[46px] text-white before:absolute before:top-[30%] before:left-[15%] before:-z-10 before:h-[210px] before:w-[400px] before:-rotate-25 before:rounded-full before:bg-blue-200 before:opacity-[.23] before:blur-[70px] before:content-[''] mid:p-7 phone:hidden" aria-label="About Techomato Colleges">
          <div className="absolute -top-[275px] -right-[240px] -z-10 size-[570px] rounded-full border border-blue-200/12" aria-hidden="true" /><div className="absolute -bottom-[340px] -left-[230px] -z-10 size-[650px] rounded-full border border-blue-200/12" aria-hidden="true" />
          <span className="absolute top-[43px] left-[42px] text-[11px] font-semibold tracking-[2.3px] text-blue-100">THE COLLEGE WORKSPACE</span>
          <div className="w-full rounded-[30px] border border-white/19 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--white)_12%,transparent),color-mix(in_srgb,var(--white)_4%,transparent))] px-[27px] pt-[38px] pb-[30px] text-center shadow-[0_20px_50px_var(--shade)] backdrop-blur-[22px]">
            <div className="flex items-center justify-center gap-[11px] text-2xl font-bold tracking-[-.8px]"><BrandMark size={40} />Techomato</div>
            <h2 className="mt-[27px] mb-0 text-[28px] leading-[1.35] font-medium tracking-[-.7px]">Everything academic.<br /><em className="font-serif font-normal text-blue-100">Beautifully connected.</em></h2>
            <p className="mx-auto mt-[17px] mb-0 max-w-[290px] text-xs leading-[1.8] text-blue-100">Attendance, timetables, exams and results for admins, teachers and students in one calm workspace.</p>
            <div className="mx-auto mt-[25px] mb-[18px] h-px w-[38px] bg-blue-200/40" />
            <span className="text-[11px] tracking-[2px] text-blue-100">LEARN. CONNECT. GROW.</span>
          </div>
          <div className="absolute right-10 bottom-[35px] left-10 flex justify-between gap-5 text-[11px] text-blue-100"><span>Built around your people.</span><span>College ERP</span></div>
        </aside>
      </div>
    </div>
  );
}

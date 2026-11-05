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
    <div className="login">
      <div className="auth-card">
        <main className="auth-form-panel">
          <div className="auth-form-content">
            <div className="auth-top">
              <Link className="auth-brand" to="/"><BrandMark size={36} />Techomato Colleges</Link>
              <ThemeToggle />
            </div>
            <header className="auth-heading"><h1>Welcome back.</h1><p>Sign in with the email your college gave you.</p></header>
            <div className="auth-section-label"><span>Sign in to your account</span><ShieldCheck size={16} /></div>
            <Alert kind="error">{error || accountError}</Alert>
            <Alert kind="ok">{done}</Alert>
            <form onSubmit={submit}>
              <Input label="Email or username" autoComplete="username" required value={email} onChange={setEmail} />
              <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={setPassword} />
              <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></Button>
              <Button onClick={reset} disabled={busy || !email}>Forgot password? Email me a reset link</Button>
            </form>
            <p className="auth-help"><Link to="/">← Back to home</Link></p>
          </div>
        </main>
        <aside className="auth-visual" aria-label="About Techomato Colleges">
          <div className="auth-orbit" aria-hidden="true" /><div className="auth-orbit two" aria-hidden="true" />
          <span className="auth-kicker">THE COLLEGE WORKSPACE</span>
          <div className="auth-glass">
            <div className="glass-brand"><BrandMark size={40} />Techomato</div>
            <h2>Everything academic.<br /><em>Beautifully connected.</em></h2>
            <p>Attendance, timetables, exams and results for admins, teachers and students in one calm workspace.</p>
            <div className="rule" />
            <span>LEARN. CONNECT. GROW.</span>
          </div>
          <div className="auth-foot"><span>Built around your people.</span><span>College ERP</span></div>
        </aside>
      </div>
    </div>
  );
}

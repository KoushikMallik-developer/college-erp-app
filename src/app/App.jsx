import { Suspense, lazy, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, ClipboardCheck, Clock, FileText, GraduationCap, History, LayoutDashboard, Library as LibraryIcon, LogOut, Megaphone, Menu, MessageSquare, Settings as SettingsIcon, ShieldCheck, UserRound, Users as UsersIcon } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useCtx } from './AuthProvider';
import LiveProvider from './LiveProvider';
import { Loading } from '../components/ui';
import ErrorBoundary from '../components/ErrorBoundary';
import Bell from '../components/Bell';
import SearchPalette from '../components/SearchPalette';
import { OfflineBanner, ThemeToggle } from '../components/widgets';
import { ROLES, isAdminRole } from '../lib/tenant';
import Login from '../features/auth/Login';
const Landing = lazy(() => import('../features/landing/Landing'));
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Colleges = lazy(() => import('../features/platform/Colleges'));
const PlatformAdmins = lazy(() => import('../features/platform/PlatformAdmins'));
const Students = lazy(() => import('../features/students/Students'));
const StudentDetail = lazy(() => import('../features/students/StudentDetail'));
const Faculty = lazy(() => import('../features/faculty/Faculty'));
const FacultyDetail = lazy(() => import('../features/faculty/FacultyDetail'));
const Academics = lazy(() => import('../features/academics/Academics'));
const Timetable = lazy(() => import('../features/academics/Timetable'));
const Attendance = lazy(() => import('../features/attendance/Attendance'));
const Exams = lazy(() => import('../features/exams/Exams'));
const Materials = lazy(() => import('../features/materials/Materials'));
const Announcements = lazy(() => import('../features/announcements/Announcements'));
const Users = lazy(() => import('../features/users/Users'));
const Settings = lazy(() => import('../features/users/Settings'));
const Profile = lazy(() => import('../features/users/Profile'));
const Calendar = lazy(() => import('../features/calendar/Calendar'));
const Requests = lazy(() => import('../features/requests/Requests'));
const Library = lazy(() => import('../features/library/Library'));

function navFor(role) {
  if (role === ROLES.PLATFORM_ADMIN) return [['/dashboard', 'Colleges'], ['/admins', 'Platform admins']];
  const common = [['/dashboard', 'Dashboard']];
  if (isAdminRole(role)) {
    return [
      ...common,
      ['/students', 'Students'], ['/faculty', 'Faculty'], ['/academics', 'Academics'],
      ['/timetable', 'Timetable'], ['/attendance', 'Attendance'], ['/exams', 'Exams'],
      ['/materials', 'Class materials'], ['/library', 'Library'], ['/calendar', 'Calendar'], ['/requests', 'Requests'], ['/announcements', 'Announcements'], ['/users', 'Users & audit'],
      ...(role === ROLES.SUPER_ADMIN ? [['/settings', 'College settings']] : []),
    ];
  }
  if (role === ROLES.FACULTY) {
    return [
      ...common, ['/attendance', 'Attendance'], ['/exams', 'Marks entry'], ['/materials', 'Class materials'], ['/library', 'Library'],
      ['/timetable', 'My timetable'], ['/calendar', 'Calendar'], ['/requests', 'My requests'], ['/announcements', 'Announcements'], ['/profile', 'My profile'],
    ];
  }
  if (role === ROLES.LIBRARIAN) {
    return [...common, ['/library', 'Library'], ['/calendar', 'Calendar'], ['/announcements', 'Announcements'], ['/profile', 'My profile']];
  }
  return [
    ...common, ['/attendance', 'My attendance'], ['/exams', 'My results'], ['/materials', 'Class materials'], ['/library', 'Library'],
    ['/timetable', 'Timetable'], ['/calendar', 'Calendar'], ['/requests', 'My requests'], ['/announcements', 'Announcements'], ['/profile', 'My profile'],
  ];
}

// Sidebar icon and heading per page; pages missing here get the default icon and the previous heading.
const NAV_META = {
  '/dashboard': [LayoutDashboard, 'WORKSPACE'], '/students': [UsersIcon, 'ACADEMICS'], '/faculty': [UserRound, 'ACADEMICS'],
  '/academics': [BookOpen, 'ACADEMICS'], '/timetable': [Clock, 'ACADEMICS'], '/attendance': [ClipboardCheck, 'ACADEMICS'],
  '/exams': [GraduationCap, 'ACADEMICS'], '/materials': [FileText, 'CAMPUS LIFE'], '/library': [LibraryIcon, 'CAMPUS LIFE'],
  '/calendar': [CalendarDays, 'CAMPUS LIFE'], '/requests': [MessageSquare, 'CAMPUS LIFE'], '/announcements': [Megaphone, 'CAMPUS LIFE'],
  '/profile': [UserRound, 'CAMPUS LIFE'], '/users': [History, 'ADMINISTRATION'], '/settings': [SettingsIcon, 'ADMINISTRATION'], '/admins': [ShieldCheck, 'ADMINISTRATION'],
};

// Phones get a bottom bar with the first four of these the role can open, plus "More" for the full menu.
const TABS = { '/dashboard': 'Home', '/attendance': 'Attendance', '/exams': 'Exams', '/requests': 'Requests', '/students': 'Students', '/admins': 'Admins', '/library': 'Library' };

function Shell() {
  const { role, profile, institution, logout } = useCtx();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('sidebar') === 'collapsed'; } catch { return false; } });
  // Phone: the menu slides in over the page. Desktop: it hides and shows the sidebar, and the choice is remembered.
  const toggleMenu = () => {
    if (window.matchMedia('(max-width: 800px)').matches) return setOpen(true);
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('sidebar', next ? 'collapsed' : 'open'); } catch { /* storage blocked: lasts until reload */ }
  };
  const { pathname } = useLocation();
  const admin = isAdminRole(role);
  const platform = role === ROLES.PLATFORM_ADMIN;
  const nav = navFor(role);
  const tabs = Object.keys(TABS).filter((to) => nav.some(([p]) => p === to)).slice(0, 4);
  const current = nav.find(([to]) => pathname === to || pathname.startsWith(`${to}/`))?.[1];
  const initials = profile.displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const roleName = role.replace('_', ' ').toLowerCase();
  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand"><BrandMark size={36} /><span>Techomato Colleges</span></div>
        <div className="institution">
          <span className="institution-symbol">{(institution?.name ?? 'T')[0]}</span>
          <div><strong>{institution?.name ?? 'Platform'}</strong><small>{roleName}</small></div>
        </div>
        <nav aria-label="Main">
          {nav.map(([to, label], i) => {
            const [NavIcon = LayoutDashboard, group] = NAV_META[to] ?? [];
            const prev = NAV_META[nav[i - 1]?.[0]]?.[1];
            return (
              <div key={to}>
                {group && group !== prev && <div className="nav-group">{group}</div>}
                <NavLink to={to} onClick={() => setOpen(false)}><NavIcon size={18} /><span>{label}</span></NavLink>
              </div>
            );
          })}
        </nav>
        <div className="who">
          <span className="avatar">{initials}</span>
          <div className="who-text"><strong>{profile.displayName}</strong><span>{roleName}</span></div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>
      <nav className="tabbar" aria-label="Quick links">
        {tabs.map((to) => {
          const [Glyph = LayoutDashboard] = NAV_META[to] ?? [];
          return <NavLink key={to} to={to}><Glyph size={20} /><span>{TABS[to]}</span></NavLink>;
        })}
        <button type="button" onClick={() => setOpen(true)} aria-label="More pages"><Menu size={20} /><span>More</span></button>
      </nav>
      {open && <button type="button" className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <div className="app-body">
      <header className="topbar">
        <button type="button" className="icon-btn menu-btn" onClick={toggleMenu} aria-label="Toggle navigation" aria-expanded={open || !collapsed}><Menu size={22} /></button>
        <div className="breadcrumb">Workspace <span>/</span><strong>{current ?? 'Dashboard'}</strong></div>
        <div className="topbar-right">
          <SearchPalette pages={nav} />
          <ThemeToggle />
          {!platform && <Bell />}
          {!admin && !platform && <Link className="user-chip" to="/profile"><span className="avatar">{initials}</span><span><strong>{profile.displayName}</strong><small>{roleName}</small></span></Link>}
        </div>
      </header>
      <main className="main">
        <OfflineBanner />
        <ErrorBoundary key={pathname} onSignOut={logout}>
        <Suspense fallback={<Loading />}>
        <Routes>
          {role === ROLES.PLATFORM_ADMIN ? (
            <>
              <Route path="/dashboard" element={<Colleges />} />
              <Route path="/admins" element={<PlatformAdmins />} />
            </>
          ) : (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/library" element={<Library />} />
              {(admin || role === ROLES.STUDENT || role === ROLES.FACULTY) && <Route path="/requests" element={<Requests />} />}
              {admin && <Route path="/students" element={<Students />} />}
              {admin && <Route path="/students/:id" element={<StudentDetail />} />}
              {admin && <Route path="/faculty" element={<Faculty />} />}
              {admin && <Route path="/faculty/:id" element={<FacultyDetail />} />}
              {admin && <Route path="/academics" element={<Academics />} />}
              {admin && <Route path="/users" element={<Users />} />}
              {role === ROLES.SUPER_ADMIN && <Route path="/settings" element={<Settings />} />}
              {!admin && <Route path="/profile" element={<Profile />} />}
            </>
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, user, profile } = useCtx();
  const signedIn = !loading && user && profile;
  // The landing page (/) and sign-in (/login) are public for everyone and never wait for Firebase.
  // Every other address is the app: it waits for sign-in, and a visitor is sent to /login.
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={signedIn ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="*" element={loading ? <Loading /> : signedIn ? <LiveProvider><Shell /></LiveProvider> : <Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

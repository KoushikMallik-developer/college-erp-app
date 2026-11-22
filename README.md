# Techomato Colleges

Internal college management system for Techomato: students, faculty, academics, timetable, attendance, exams and results, fees, assignments, library, announcements and class materials, for any number of colleges in one deployment.

**Stack:** React 18, Vite 5, Tailwind CSS 4, Firebase (Auth and Firestore on the Spark plan). There is no server code and no Cloud Functions.

Related documents: [product.md](product.md) (what the product does), [system_design.md](system_design.md) (how and why, including known limits), [memory.md](memory.md) (decision log).

## Architecture

- **Firestore Security Rules are the backend.** [firestore.rules](firestore.rules) enforce roles and college isolation on every request. All college data lives under `institutions/{id}/…`.
- **Roles:** Platform Admin (owns the deployment, no access to college data), Super Admin, College Admin, Faculty, Student, Parent, Librarian. A user's role and `active` flag live in `users/{uid}`.
- **Files** (student documents, class materials) are stored inside Firestore, 900 KB at most each. The same rules that guard records guard the file bytes. Large photos are shrunk in the browser.
- **Business rules** (attendance percentage, pass or fail, timetable generation, class timing) are plain functions in [src/lib/calc.js](src/lib/calc.js), covered by unit tests.
- **Time** is always read in the college's own time zone, not the device's.

## Project layout

| Path | What is in it |
|---|---|
| `src/app/` | App shell, routes, sign-in state (`AuthProvider`) and the live-refresh signal (`LiveProvider`) |
| `src/features/<area>/` | One folder per screen group: students, faculty, academics, attendance, exams, fees, assignments, library, and so on |
| `src/components/` | Shared UI (`ui.jsx`), search, bell, file panel, CSV import, error boundary |
| `src/lib/` | `calc.js` (business rules), `tenant.js` (college paths and roles), `data.js`, `audit.js`, `files.js`, `paged.js`, `firebase.js`, `firestore-live.js` (every write also nudges other users' open pages), `report.js` (crash reporter, off unless configured) |
| `tests/` | Unit and UI tests. `tests/rules/` holds the Security Rules tests |
| `scripts/` | `seed-demo.js` (demo college for the emulator) and `create-platform-admin.js` |
| `firestore.rules`, `firestore.indexes.json` | The backend rules and the indexes the screens need |
| `.github/` | Pull request template and issue templates (bug report, feature request) |

## Features

| Role | What they can do |
|---|---|
| Platform admin | Create and suspend colleges, manage platform admins. Cannot read any college's data |
| Super admin | Everything a college admin does, plus college settings (name, time zone, grade points), the CSV backup, and creating college admins |
| College admin | Students, faculty, academics, timetable, attendance, exams and results, assignments, fees, class materials, announcements, requests inbox, library, CSV import, class promotion, calendar, users and audit log |
| Faculty | Attendance, marks entry, assignments, class materials, timetable, calendar, library, leave requests and concerns. The dashboard shows classes taught, own attendance and leave, and the class running now |
| Student | Own attendance, results and hall ticket, timetable, assignments, fees, class materials, library loans, calendar, leave requests and concerns. The dashboard shows the class running now |
| Parent | Read-only view of one student: attendance, results, timetable, fees, calendar, announcements |
| Librarian | The books and loans of their own library, calendar, announcements |
| Everyone | Search (Ctrl K or `/`), notification bell, light and dark theme, installable app shell |

### Behaviour worth knowing

- **Timetable:** classes carry start and end times. Generate asks for when the college starts and ends and how long each class is. No teacher, room or section is double-booked. Generation fills empty periods by default, or replaces the week if asked, and saves in batches. If a room or teacher is booked meanwhile, saving stops and says how many were saved. Generate again to fill the rest. Timetables saved before times existed show no times until regenerated.
- **One-day changes:** on a timetable slot, an admin can cancel the class or name a substitute teacher for one date. Students, the teacher who is away, and the substitute see it on their dashboard that day and get a message. The weekly timetable is not changed. The substitute's own classes in that period are not checked for a clash.
- **Attendance:** the teacher's period list comes from their timetable for the chosen class and weekday, and today it preselects the lesson running now. Students see how many classes to attend to get back to 75%, or how many they can still miss. Admins can filter a class report to students under 75% and print it.
- **Exams:** each paper can carry a date, time and room (set while the exam is a draft). Students see upcoming papers and can print a hall ticket. Results show SGPA per exam and CGPA overall. Grade points are set in College settings (blank uses 90:10, 80:9, 70:8, 60:7, 50:6, 40:5). Every paper counts the same, because subjects have no credits.
- **Class alerts:** students and faculty see a message 10 minutes before a class, when it starts, and when it ends. These appear only while the app is open. Spark has no push notifications.
- **Assignments:** a teacher posts a task for a class with a due date and an optional material link. Students hand in by pasting a link (for example a Google Drive share link) and can replace it until the due date. The teacher sees who has and has not handed in. A posted task cannot be edited (delete it and post again), and a hand-in is accepted only for a task of the student's own class. Direct upload to Google Cloud Storage is not built: it needs the Blaze plan.
- **Fees:** an admin adds charges and records payments per student. Students and parents see the totals and the entries. There is no online payment. Entries cannot be edited or deleted, so a mistake is fixed with a new entry. "Who owes fees" reads the whole ledger once, on request.
- **Parent login:** on a student's page, Parent login, an admin creates a login that is tied to that student. A parent can only read that student's attendance, results, timetable, fees, calendar and announcements. Student documents and requests are not visible to a parent.
- **Requests:** students and faculty file leave or concerns. An admin approves, rejects (reason required) or resolves them. Approved leave does not change attendance by itself.
- **Library:** created per college by an admin (name and librarian email). Each library has its own librarian login and books. A loan is 14 days and a student may hold 3 books per library. Fines are off. The 3-book limit is checked by the app, not the rules.
- **Import and promotion:** students and faculty import from CSV with row-by-row results. Promoting a class moves one section's active enrollments to another semester. If it stops part-way, run it again. CSV exports neutralise cells starting with `=`, `+`, `-` or `@`.
- **Live refresh:** pages reload when someone else saves, at most every 2 minutes and only in the visible tab, to stay inside the free read quota. Bell and search use a few reads on load, never live listeners.
- **Offline:** a service worker keeps the app shell only. Data is never cached by it, and saving needs a connection.

## Setup

Requires Node 18 or later.

```bash
npm install
cp .env.example .env     # fill in the Firebase web config
npm run dev
```

Environment variables are documented in [.env.example](.env.example). Other scripts: `npm run build` (production build into `dist/`), `npm run preview` (serve that build), `npm test`, `npm run test:rules`.

### Local emulators

Set `VITE_USE_EMULATOR=true` in `.env`, then:

```bash
npx firebase emulators:start --only auth,firestore --project demo-erp
```

Seed a demo college (refuses to run against a real project; every demo login uses the password `Passw0rd!`):

```bash
GCLOUD_PROJECT=demo-erp FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-demo.js
```

Demo logins: `principal@demo.test`, `teacher@demo.test`, `student@demo.test`, `librarian@demo.test`, and `admin@techomato.local` (platform admin).

## Testing

```bash
npm test             # business rules and UI behaviour, no emulator needed
npm run test:rules   # Security Rules against the Firestore emulator (needs Java)
```

The rules suite covers college isolation, role limits, audit entries, attendance and marks ownership, timetable locks, enrollment-number uniqueness, file slots, result privacy, parent logins, the fee ledger, and assignments and hand-ins. If it stops with "port taken", end the leftover Java emulator process (seen on Windows) or change the port in `firebase.rules-test.json`.

## Production deployment

1. **Firebase project:** enable Email/Password sign-in and create Firestore in production mode. Put the project ID in `.firebaserc` and the web config in `.env`.
2. **Rules and indexes:** `npx firebase deploy --only firestore`. Redeploy whenever `firestore.rules` or `firestore.indexes.json` changes. Several screens need the composite indexes and fail without them.
3. **Hosting**, either:
   - **Firebase Hosting:** `npm run build`, then `npx firebase deploy --only hosting`.
   - **Vercel:** import the repo (framework Vite). [vercel.json](vercel.json) sets the build, the page-reload rewrite and security headers. Add the `VITE_*` values as environment variables with `VITE_USE_EMULATOR=false`. Add the Vercel domain under Firebase console, Authentication, Settings, Authorized domains, or sign-in fails.
4. **First platform admin:** run [scripts/create-platform-admin.js](scripts/create-platform-admin.js) with `PLATFORM_ADMIN_PASSWORD` set and a service-account key kept outside this repository. Then sign in, create a college (this creates its first Super Admin) and set up departments, courses, subjects, years, semesters, sections, faculty and students.
5. **App Check (recommended):** register the web app with reCAPTCHA v3, set `VITE_APPCHECK_SITE_KEY`, and watch in monitor mode before enforcing. Leave the key empty for local work. On Vercel, register that domain for the key too.
6. **Site address:** set `VITE_SITE_URL` so link previews work, and `VITE_CONTACT_EMAIL` to show a Contact button on the public page.

Both hosting configs send a Content-Security-Policy. If you add a new outside service (analytics, another font host), allow it there or the browser blocks it. If you edit the small theme script in `index.html`, update its `sha256` value in the header.

**Backups:** there are no automatic backups on Spark. College settings has a Backup card that downloads every record as CSV files. Do it monthly and keep the files safe.

## Operating limits

- Files share Firestore's 1 GiB limit with all other data. Roughly 2000 students with three 250 KB files each would not fit. Keep documents optional, or move files to Firebase Storage (Blaze plan).
- Spark's free daily quota (20,000 writes a day) is shared by every college. Treat Spark as a pilot for one college. Running several colleges in production needs the Blaze plan. Spread bulk marks entry and result publishing over several days.
- Without server code, a hostile staff member could use up the shared write quota, and the rules cannot confirm that a student belongs to the section they are marked in. [system_design.md](system_design.md) lists each limit and its upgrade path.
- One email address belongs to one college.

## Contributing

Open an issue with the bug report or feature request template, and fill in the pull request template. Before a pull request: `npm test` and `npm run build` must pass, and `npm run test:rules` too if `firestore.rules` changed. Every new collection or field needs a matching rule, and every new query an index in `firestore.indexes.json`. Never commit `.env`, service-account keys or real student data.

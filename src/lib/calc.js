// Pure business rules. Kept free of Firebase so they can be unit tested.

export const STATUSES = ['PRESENT', 'ABSENT', 'LEAVE'];

// Attendance map key: d{YYYYMMDD}_{period}. Valid as a Firestore field path.
export const recordKey = (date, period) => `d${date.replaceAll('-', '')}_${period}`;

// Per student, how today's mark is written: create the document, add an entry, or edit an existing
// entry (an edit needs its own audit entry). Unchanged marks are skipped.
export function planAttendanceWrites(roster, saved, key, statusOf) {
  const plan = [];
  for (const student of roster) {
    const next = statusOf(student);
    const doc = saved[student.studentId];
    if (!doc) plan.push({ student, next, kind: 'create' });
    else if (doc.records[key] === undefined) plan.push({ student, next, kind: 'add' });
    else if (doc.records[key] !== next) plan.push({ student, next, kind: 'edit', old: doc.records[key] });
  }
  return plan;
}

// One batch may trigger about 20 document lookups in the rules (measured: 17 distinct lookups plus the user, college
// and assignment lookups pass, 18 fail). Items carry a `cost`; groups stay under `limit`.
export function groupByCost(items, limit) {
  const groups = [];
  let cur = [];
  let cost = 0;
  for (const item of items) {
    if (cur.length && cost + item.cost > limit) {
      groups.push(cur);
      cur = [];
      cost = 0;
    }
    cur.push(item);
    cost += item.cost;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export const enrollmentKey = (number) => number.trim().toUpperCase();
export const roomKey = (room) => room.trim().toLowerCase();

// present / (present + absent) x 100, LEAVE excluded. null when nothing counts yet.
export function percent(present, absent) {
  const total = present + absent;
  return total === 0 ? null : Math.round((present / total) * 1000) / 10;
}

export const MIN_ATTENDANCE = 75;

// What a student needs to hear: below the minimum, how many classes in a row to attend to get back to it;
// at or above it, how many classes can still be missed. Leave is not counted, as in percent().
export function attendanceAdvice(present, absent, target = MIN_ATTENDANCE) {
  const total = present + absent;
  if (!total) return null;
  if (present * 100 >= target * total) return { ok: true, spare: Math.floor((present * 100) / target) - total };
  return { ok: false, need: Math.ceil((target * total - 100 * present) / (100 - target)) };
}

// docs: studentAttendance documents of one student. Returns totals per subjectId.
export function attendanceBySubject(docs) {
  const out = {};
  for (const d of docs) {
    const t = (out[d.subjectId] ??= { present: 0, absent: 0, leave: 0 });
    for (const status of Object.values(d.records ?? {})) {
      if (status === 'PRESENT') t.present++;
      else if (status === 'ABSENT') t.absent++;
      else if (status === 'LEAVE') t.leave++;
    }
  }
  for (const t of Object.values(out)) t.percent = percent(t.present, t.absent);
  return out;
}

// The marks of one subject date by date: [{ id, date: 'YYYY-MM-DD', period, status }], newest first. Record keys look like d20261031_2.
export function attendanceEntries(docs) {
  const out = [];
  for (const d of docs) {
    for (const [key, status] of Object.entries(d.records ?? {})) {
      const m = /^d(\d{4})(\d{2})(\d{2})_(\d+)$/.exec(key);
      if (m) out.push({ id: `${d.assignmentId ?? ''}${key}`, date: `${m[1]}-${m[2]}-${m[3]}`, period: Number(m[4]), status });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period);
}

// Grade points: [minimum percentage, points], highest first. Below the last band, or a failed paper, earns 0.
export const DEFAULT_SCALE = [[90, 10], [80, 9], [70, 8], [60, 7], [50, 6], [40, 5]];

// "90:10, 80:9, 70:8" -> [[90, 10], [80, 9], [70, 8]], or null when the text is not a clean scale.
export function parseGradeScale(text) {
  const bands = String(text ?? '').split(',').map((p) => p.trim().split(':').map(Number));
  if (!bands.length || bands.some((b) => b.length !== 2 || b.some((n) => !Number.isFinite(n)) || b[0] < 0 || b[0] > 100 || b[1] < 0 || b[1] > 10)) return null;
  const sorted = [...bands].sort((a, b) => b[0] - a[0]);
  return new Set(sorted.map((b) => b[0])).size === sorted.length ? sorted : null;
}

// subjects: a result's [{ marks, maxMarks, passMarks, absent }]. The plain average of the papers' grade points, to two places.
// shortcut: papers weigh the same because subjects carry no credits; add credits to weigh them when the college needs it.
export function gpa(subjects, scale = DEFAULT_SCALE) {
  if (!subjects.length) return null;
  const points = subjects.map((s) => {
    if (s.absent || s.marks < s.passMarks) return 0;
    const pct = (s.marks / s.maxMarks) * 100;
    return scale.find(([min]) => pct >= min)?.[1] ?? 0;
  });
  return Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100) / 100;
}

// results: published results, one per exam (about one per semester). CGPA is the average of their GPAs.
export function cgpa(results, scale = DEFAULT_SCALE) {
  const g = results.map((r) => gpa(r.subjects, scale)).filter((x) => x !== null);
  return g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 100) / 100 : null;
}

export const scaleOf = (institution) => parseGradeScale(institution?.academicSettings?.gradeScale) ?? DEFAULT_SCALE;

// papers: [{ marks, absent, maxMarks, passMarks }]. An absent paper counts as 0 and fails.
export function computeResult(papers) {
  let total = 0;
  let maxTotal = 0;
  let passed = papers.length > 0;
  for (const p of papers) {
    const got = p.absent ? 0 : Number(p.marks);
    total += got;
    maxTotal += Number(p.maxMarks);
    if (p.absent || got < Number(p.passMarks)) passed = false;
  }
  const percentage = maxTotal === 0 ? 0 : Math.round((total / maxTotal) * 10000) / 100;
  return { total, maxTotal, percentage, passed };
}

export function validTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Every enrolled student needs a marks record (or an absent mark) for every paper before results publish.
// Marks ids are {paperId}_{studentId}; a record under another section than the student's enrollment is flagged.
export function checkExam({ enrollments, examSubjects, marks }) {
  const marksById = Object.fromEntries(marks.map((m) => [m.id, m]));
  const gaps = [];
  const wrongSection = [];
  for (const en of enrollments) {
    for (const es of examSubjects) {
      const m = marksById[`${es.id}_${en.studentId}`];
      const who = `${en.enrollmentNumber} ${en.studentName}`;
      if (!m) gaps.push({ id: `${en.studentId}${es.id}`, student: who, paper: es.subjectName });
      else if (m.sectionId !== en.sectionId) wrongSection.push({ id: m.id, student: who, paper: es.subjectName });
    }
  }
  return { marksById, gaps, wrongSection };
}

// Calendar date (YYYY-MM-DD) in the college's time zone.
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

// Weekday (Mon = 1 ... Sun = 7) and minutes since midnight in the college's time zone.
export function nowIn(timeZone, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]));
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const clockMinutes = (t) => { const [h, m] = t.split(':'); return Number(h) * 60 + Number(m); };

// Which class is on now and which is next, from slots that carry startTime and endTime.
export function classNow(slots, day, minutes) {
  const today = slots.filter((s) => s.startTime && !s.off && s.dayOfWeek === day).sort((a, b) => clockMinutes(a.startTime) - clockMinutes(b.startTime));
  return {
    current: today.find((s) => clockMinutes(s.startTime) <= minutes && minutes < clockMinutes(s.endTime)),
    next: today.find((s) => clockMinutes(s.startTime) > minutes),
  };
}

const weekdayOf = (iso) => ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) + 1; // Mon = 1, as in the timetable

// The lessons a teacher has for a class on a date's weekday, from the timetable. No slots yet: all eight periods.
export function periodChoices(slots, assignmentId, date) {
  const mine = slots.filter((s) => s.assignmentId === assignmentId && s.dayOfWeek === weekdayOf(date)).sort((x, y) => x.period - y.period);
  if (!mine.length) return [1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({ value: String(p), label: String(p) }));
  return mine.map((s) => ({ value: String(s.period), label: s.startTime ? `${s.period} · ${s.startTime}–${s.endTime}` : String(s.period), slot: s }));
}

// On today's date: the lesson running now, else the next one, else the last. Any other date: the first of the day.
export function defaultPeriod(choices, isToday, minutes) {
  const timed = choices.filter((c) => c.slot?.startTime);
  if (!isToday || !timed.length) return choices[0].value;
  const hit = timed.find((c) => clockMinutes(c.slot.startTime) <= minutes && minutes < clockMinutes(c.slot.endTime))
    ?? timed.find((c) => clockMinutes(c.slot.startTime) > minutes) ?? timed.at(-1);
  return hit.value;
}

// Today's classes for one person after one-day changes. A changed class that is no longer theirs, or is cancelled,
// stays in the list with `off` set so it can be shown as such; classNow and classAlerts skip those.
// `me` is the faculty id for a teacher, or null for a student (whose slots are already their own section's).
export function applyChanges(slots, changes, me) {
  const by = Object.fromEntries(changes.map((c) => [c.slotId, c]));
  const out = slots.map((s) => {
    const c = by[s.id];
    if (!c) return s;
    if (c.type === 'CANCELLED') return { ...s, off: 'CANCELLED', reason: c.reason };
    if (me && c.substituteFacultyId !== me) return { ...s, off: 'COVERED', facultyName: c.substituteFacultyName, reason: c.reason };
    return { ...s, facultyName: c.substituteFacultyName, substitute: true, reason: c.reason };
  });
  // A teacher covering someone else's class gets it as a normal class of their own.
  if (me) for (const c of changes) if (c.type === 'SUBSTITUTE' && c.substituteFacultyId === me && !slots.some((s) => s.id === c.slotId)) {
    out.push({ id: c.slotId, dayOfWeek: c.dayOfWeek, startTime: c.startTime, endTime: c.endTime, subjectName: c.subjectName, facultyName: c.substituteFacultyName, room: c.room, substitute: true, reason: c.reason });
  }
  return out;
}

// Messages due right now: 10 minutes before a class, in the first 5 minutes of it, and in the 5 minutes after it ends.
// The windows are short on purpose: opening the app at 2pm must not replay the morning.
export function classAlerts(slots, day, minutes) {
  const out = [];
  for (const slot of slots) {
    if (!slot.startTime || slot.off || slot.dayOfWeek !== day) continue;
    const from = clockMinutes(slot.startTime), to = clockMinutes(slot.endTime);
    if (minutes >= from - 10 && minutes < from) out.push({ kind: 'upcoming', slot });
    if (minutes >= from && minutes < from + 5) out.push({ kind: 'started', slot });
    if (minutes >= to && minutes < to + 5) out.push({ kind: 'ended', slot });
  }
  return out;
}

// Firebase Auth signs in by email. A bare username such as "admin" maps to a fixed fake address.
export const loginEmail = (s) => {
  const v = s.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@techomato.local`;
};

// docs: studentAttendance documents of one student. Consecutive most-recent days present. A day counts when it has a
// PRESENT mark and no ABSENT mark; a day with only LEAVE is skipped; the first absent day ends the run.
export function attendanceStreak(docs) {
  const days = {};
  for (const d of docs) {
    for (const [key, status] of Object.entries(d.records ?? {})) {
      const day = (days[key.slice(1, 9)] ??= { present: false, absent: false });
      if (status === 'PRESENT') day.present = true;
      else if (status === 'ABSENT') day.absent = true;
    }
  }
  let streak = 0;
  for (const date of Object.keys(days).sort().reverse()) {
    if (days[date].absent) break;
    if (days[date].present) streak++;
  }
  return streak;
}

// ---- automatic timetable ----

// The three places a slot occupies. A lock is create-only, so a second slot at the same place fails.
export const slotLocks = (s) => [
  `room_${s.roomKey}_${s.dayOfWeek}_${s.period}`,
  `faculty_${s.facultyId}_${s.dayOfWeek}_${s.period}`,
  `section_${s.sectionId}_${s.dayOfWeek}_${s.period}`,
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Greedy placement, repeated with different shuffles; the attempt with the fewest unplaced sessions wins.
//   requirements: [{ id, facultyId, perWeek }]   rooms: room keys, the first is the section's own room
//   busy: Set of lock ids already taken (see slotLocks), including this section's own when it is kept
// The periods that fit between two clock times: periodTimes('09:00', '11:30', 50) -> [['09:00','09:50'], ['09:50','10:40']].
// A class that would run past the end is not counted. Bad input gives [].
export function periodTimes(start, end, mins) {
  const at = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(s ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  const from = at(start), to = at(end), len = Number(mins);
  if (!(to > from) || !Number.isInteger(len) || len < 5) return [];
  const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return Array.from({ length: Math.floor((to - from) / len) }, (_, i) => [clock(from + i * len), clock(from + (i + 1) * len)]);
}

// Returns { placements: [{ id, dayOfWeek, period, roomKey }], unplaced: [{ id, missing }] }.
export function generateTimetable({ sectionId, requirements, days, periods, rooms, busy, attempts = 60 }) {
  const cells = days.flatMap((d) => periods.map((p) => [d, p]));
  let best = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rand = attempt === 0 ? () => 0 : mulberry32(attempt);
    const taken = new Set(busy);
    const dayLoad = Object.fromEntries(days.map((d) => [d, 0]));
    const onDay = {}; // `${id}_${day}` -> periods of that subject that day
    const placements = [];
    const unplaced = [];
    const order = [...requirements].sort((x, y) => y.perWeek - x.perWeek || (attempt ? rand() - 0.5 : 0));
    for (const req of order) {
      let missing = 0;
      for (let k = 0; k < req.perWeek; k++) {
        let pick = null;
        for (const [d, p] of cells) {
          if (taken.has(`section_${sectionId}_${d}_${p}`) || taken.has(`faculty_${req.facultyId}_${d}_${p}`)) continue;
          const room = rooms.find((r) => !taken.has(`room_${r}_${d}_${p}`));
          if (room === undefined) continue;
          const same = onDay[`${req.id}_${d}`] ?? [];
          // Lower is better: spread a subject over the days, keep each day evenly loaded, avoid back-to-back
          // repeats, lean to earlier periods, and a little noise so retries explore other layouts.
          const score = same.length * 4 + dayLoad[d] + (same.some((q) => Math.abs(q - p) === 1) ? 3 : 0) + p * 0.1 + rand() * 0.8;
          if (!pick || score < pick.score) pick = { d, p, room, score };
        }
        if (!pick) { missing++; continue; }
        taken.add(`section_${sectionId}_${pick.d}_${pick.p}`);
        taken.add(`faculty_${req.facultyId}_${pick.d}_${pick.p}`);
        taken.add(`room_${pick.room}_${pick.d}_${pick.p}`);
        dayLoad[pick.d]++;
        (onDay[`${req.id}_${pick.d}`] ??= []).push(pick.p);
        placements.push({ id: req.id, dayOfWeek: pick.d, period: pick.p, roomKey: pick.room });
      }
      if (missing) unplaced.push({ id: req.id, missing });
    }
    const lost = unplaced.reduce((n, u) => n + u.missing, 0);
    if (!best || lost < best.lost) best = { placements, unplaced, lost };
    if (lost === 0) break;
  }
  return { placements: best.placements, unplaced: best.unplaced };
}

// A cell starting with = + - @ (or tab/CR) would run as a formula in Excel, so it gets a leading apostrophe.
// Documents -> CSV rows with one column per field seen. Timestamps become dates, maps and lists become JSON text.
export function docRows(docs) {
  const cols = [...new Set(docs.flatMap((d) => Object.keys(d)))].sort((a, b) => (a === 'id' ? -1 : b === 'id' ? 1 : a.localeCompare(b)));
  const cell = (v) => (v == null ? '' : typeof v.toDate === 'function' ? v.toDate().toISOString() : typeof v === 'object' ? JSON.stringify(v) : v);
  return [cols, ...docs.map((d) => cols.map((c) => cell(d[c])))];
}

// Fee ledger entries [{ type: 'CHARGE' | 'PAYMENT', amount }] -> what was charged, what was paid, and what is still due (negative = paid ahead).
export function feeBalance(entries) {
  const sum = (type) => Math.round(entries.filter((e) => e.type === type).reduce((n, e) => n + e.amount * 100, 0)) / 100;
  const charged = sum('CHARGE'), paid = sum('PAYMENT');
  return { charged, paid, due: Math.round((charged - paid) * 100) / 100 };
}

// Everyone's ledger entries -> one row per student who still owes something, the biggest debt first.
export function feeDebtors(entries) {
  const by = new Map();
  for (const e of entries) { const l = by.get(e.studentId) ?? { studentId: e.studentId, studentName: e.studentName, rows: [] }; l.rows.push(e); by.set(e.studentId, l); }
  return [...by.values()].map((l) => ({ studentId: l.studentId, studentName: l.studentName, ...feeBalance(l.rows) })).filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
}

// Whole rupees or paise only: 1200, 1200.5, 1200.55. Anything else is refused before it is saved.
export const validAmount = (text) => /^\d{1,8}(\.\d{1,2})?$/.test(String(text).trim()) && Number(text) > 0;

// A link a student or teacher may attach: https only, no spaces, short. The rules enforce the same.
export const validLink = (text) => /^https:\/\/\S+$/.test(String(text).trim()) && String(text).trim().length <= 500;

// Where a task stands for a student: handed in, overdue, or still open. Dates are YYYY-MM-DD in the college's time zone.
export const taskState = (dueDate, today, submitted) => (submitted ? 'submitted' : dueDate < today ? 'overdue' : 'open');

export const csvEscape = (v) => {
  const t = String(v ?? '');
  const risky = /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t);
  return `"${(risky ? `'${t}` : t).replaceAll('"', '""')}"`;
};
export const toCsv = (rows) => rows.map((r) => r.map(csvEscape).join(',')).join('\n');

// Waiting or approved leave that shares a day with the new range (ISO dates compare as text).
export const leaveOverlaps = (requests, from, to) =>
  requests.filter((r) => r.kind === 'LEAVE' && ['PENDING', 'APPROVED'].includes(r.status) && r.fromDate <= to && from <= r.toDate);

// Reads CSV text into rows of cells. Handles quotes, doubled quotes, commas and line breaks inside quotes, CRLF and a BOM.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// Dates are plain YYYY-MM-DD text in the college's time zone; adding days works in UTC so daylight saving cannot shift them.
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// Whole days past the due date; 0 on or before it. `until` is the return date, or today for a loan still out.
export const overdueDays = (dueDate, until) => Math.max(0, Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000));

// Enrollments to move in a promotion: the student has no enrollment in the target semester yet. The rest are left alone.
export const splitPromotion = (active, targetRows) => {
  const taken = new Set(targetRows.map((e) => e.studentId));
  return { move: active.filter((e) => !taken.has(e.studentId)), skipped: active.filter((e) => taken.has(e.studentId)) };
};

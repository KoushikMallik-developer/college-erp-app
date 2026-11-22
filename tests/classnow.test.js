// @vitest-environment jsdom
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Monday 09:20 in the college. The card needs only the signed-in user, the clock and the timetable rows.
const slots = [
  { id: 'a', dayOfWeek: 1, startTime: '09:00', endTime: '09:45', subjectName: 'Maths', facultyName: 'Rao', room: '101' },
  { id: 'b', dayOfWeek: 1, startTime: '10:00', endTime: '10:45', subjectName: 'Physics', facultyName: 'Iyer', room: '102' },
  { id: 'c', dayOfWeek: 2, startTime: '09:00', endTime: '09:45', subjectName: 'Tuesday only' },
];
vi.mock('../src/app/AuthProvider', () => ({
  useCtx: () => ({ iid: 'i', uid: 'u', role: 'FACULTY', profile: { facultyId: 'f' }, now: () => ({ day: 1, minutes: 9 * 60 + 20 }), today: () => '2026-11-02' }),
}));
vi.mock('firebase/firestore', () => ({ limit: () => 0, query: () => 0, where: () => 0 }));
vi.mock('../src/lib/tenant', () => ({ ROLES: { FACULTY: 'FACULTY', STUDENT: 'STUDENT' }, tcol: () => 0 }));
vi.mock('../src/lib/data', () => ({ list: async () => slots }));
vi.mock('../src/components/ui', () => ({ useToast: () => () => {} }));
vi.mock('../src/components/Bell', () => ({ chime: () => {}, soundOn: () => false }));

it("shows today's classes only, marks the one running, and counts the finished ones", async () => {
  const { default: ClassNow } = await import('../src/features/dashboard/ClassNow.jsx');
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  await act(async () => root.render(h(ClassNow)));
  expect(el.textContent).toContain('In class now');
  expect(el.textContent).toContain('25 min left');
  expect(el.textContent).toContain('Physics');
  expect(el.textContent).not.toContain('Tuesday only');
  expect(el.textContent).toContain('0 of 2 done');
  expect(el.querySelectorAll('li[aria-current="true"]')).toHaveLength(1);
  await act(() => root.unmount());
});

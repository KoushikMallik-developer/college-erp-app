// @vitest-environment jsdom
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { Table } from '../src/components/ui.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => act(() => root.unmount()));

const rows = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Name ${String(i).padStart(2, '0')}`, n: i }));
const columns = [{ key: 'name', label: 'Name' }, { key: 'n', label: 'N' }];
const mount = async (props) => {
  const el = document.body.appendChild(document.createElement('div'));
  root = createRoot(el);
  await act(() => root.render(h(Table, { columns, rows, ...props })));
  return el;
};
const names = (el) => [...el.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);

it('shows 25 rows per page and moves to the next page', async () => {
  const el = await mount();
  expect(names(el)).toHaveLength(25);
  await act(() => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Next').click());
  expect(names(el)).toEqual(['Name 25', 'Name 26', 'Name 27', 'Name 28', 'Name 29']);
});

it('sorts a column both ways when its heading is clicked', async () => {
  const el = await mount();
  const heading = () => [...el.querySelectorAll('th button')].find((b) => b.textContent.startsWith('N') && !b.textContent.startsWith('Na'));
  await act(() => heading().click());
  expect(names(el)[0]).toBe('Name 00');
  await act(() => heading().click());
  expect(names(el)[0]).toBe('Name 29');
});

it('plain tables show every row and no controls', async () => {
  const el = await mount({ plain: true });
  expect(names(el)).toHaveLength(30);
  expect(el.querySelector('select, input[type=search], th button')).toBeNull();
});

it('a column with render is sorted and filtered by its text(), and ignored without one', async () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `P${String(i).padStart(2, '0')}`, who: i }));
  const cols = [
    { key: 'who', label: 'Who', text: (r) => r.name, render: (r) => `person ${r.name}` },
    { key: 'raw', label: 'Raw', render: (r) => r.name },
  ];
  const el = await mount({ rows: people, columns: cols });
  expect(el.querySelectorAll('th button')).toHaveLength(1); // only the column with text() can be sorted
  const filter = el.querySelector('input[type=search]');
  await act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(filter, 'p07'); filter.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(names(el)).toEqual(['person P07']);
});

it('shows no filter box when no column can be searched', async () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `P${i}` }));
  const el = await mount({ rows: people, columns: [{ key: 'name', label: 'Name', render: (r) => r.name }] });
  expect(el.querySelector('input[type=search]')).toBeNull();
});

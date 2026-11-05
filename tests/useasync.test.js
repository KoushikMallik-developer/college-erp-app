// @vitest-environment jsdom
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { useAsync } from '../src/components/ui.jsx';
import { LiveCtx } from '../src/lib/liveContext.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(() => act(() => root.unmount()));

// Records everything the page would have shown. Each load returns "<input>-<call number>".
let calls = 0;
let shown = [];
function Page({ x }) {
  const { data, loading } = useAsync(async () => `${x}-${++calls}`, [x]);
  shown.push(loading ? 'loading' : data);
  return h('p', null, loading ? 'loading' : data);
}
const show = (live, x) => act(() => root.render(h(LiveCtx.Provider, { value: live }, h(Page, { x }))));

it('a live change reloads without showing loading; a changed input shows it', async () => {
  calls = 0;
  shown = [];
  root = createRoot(document.body.appendChild(document.createElement('div')));
  await show(0, 'a');
  expect(shown.at(-1)).toBe('a-1');

  shown = [];
  await show(1, 'a'); // someone changed the college
  expect(shown).not.toContain('loading');
  expect(shown.at(-1)).toBe('a-2');

  shown = [];
  await show(1, 'b'); // a different input is a real load
  expect(shown).toContain('loading');
  expect(shown.at(-1)).toBe('b-3');
});

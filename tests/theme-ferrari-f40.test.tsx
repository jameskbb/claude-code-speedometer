import { expect, mock, test } from 'claude-code/testing'

import { f40Cells, mainCells, MW, SM, smallCells, tachCells, TW } from '../hooks/themes/ferrari-f40'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('each ferrari-f40 gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [100, false], [140, true]] as const) {
    expect(size(tachCells(p, warn))).toBe(TW * (TW / 2) * 12)
    expect(size(mainCells(p, warn))).toBe(MW * (MW / 2) * 12)
    expect(size(smallCells(p, warn))).toBe(SM * (SM / 2) * 12)
  }
  expect(size(f40Cells(14, 50, true, Math.PI, 0, 4, 0.8))).toBe(14 * 7 * 12)
})

test('the ferrari-f40 theme draws the pane', { options: { theme: 'ferrari-f40' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

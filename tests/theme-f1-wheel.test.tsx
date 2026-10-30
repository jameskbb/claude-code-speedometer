import { expect, mock, test } from 'claude-code/testing'

import { gripCells, GR, GW, lcdCells, LW, MR, MW, rotaryCells, RW, theme, wheelCells } from '../hooks/themes/f1-wheel'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: {
    title: 'Speedometer',
    isFocused: false,
    bodyColumns: 90,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('each f1 wheel painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(lcdCells(p, warn))).toBe(LW * 9 * 12)
    expect(size(rotaryCells(0x2b6cff)(p, warn))).toBe(RW * (RW / 2) * 12)
    expect(size(wheelCells({ five: p, week: p, model: p, warn: [warn, warn, warn] }))).toBe(MW * MR * 12)
    const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
    for (const d of [five, week, model]) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
  }
  expect(size(gripCells(false))).toBe(GW * GR * 12)
  expect(size(gripCells(true))).toBe(GW * GR * 12)
})

test('a warned f1 wheel paints differently', () => {
  expect(lcdCells(62, true)).not.toBe(lcdCells(62, false))
  expect(rotaryCells(0xff7a1a)(84, true)).not.toBe(rotaryCells(0xff7a1a)(84, false))
  const r = { five: 62, week: 37, model: 84 }
  for (const warn of [[true, false, false], [false, true, false], [false, false, true]] as [boolean, boolean, boolean][]) {
    expect(wheelCells({ ...r, warn })).not.toBe(wheelCells({ ...r, warn: [false, false, false] }))
  }
  expect(lcdCells(62)).not.toBe(lcdCells(37))
})

test('the f1-wheel theme draws the pane', { options: { theme: 'f1-wheel' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

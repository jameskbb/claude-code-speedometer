import { expect, mock, test } from 'claude-code/testing'

import { GROWS, GW, ribbonCells, RIBW, ribsCells, roundCells, RROWS, RW, theme } from '../hooks/themes/fifties-chrome'

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

test('each fifties-chrome painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(ribbonCells(p, warn))).toBe(RW * RROWS * 12)
    expect(size(roundCells(p, warn))).toBe(GW * GROWS * 12)
  }
  expect(size(ribsCells())).toBe(RIBW * 1 * 12)
  const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned fifties-chrome gauge paints differently', () => {
  expect(ribbonCells(62, true)).not.toBe(ribbonCells(62, false))
  expect(roundCells(84, true)).not.toBe(roundCells(84, false))
  expect(ribbonCells(37)).not.toBe(ribbonCells(62))
})

test('the fifties-chrome theme draws the pane', { options: { theme: 'fifties-chrome' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

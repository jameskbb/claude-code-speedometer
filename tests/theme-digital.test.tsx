import { expect, mock, test } from 'claude-code/testing'

import { NH, readoutCells, theme, TILE } from '../hooks/themes/digital'

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

test('each readout fills exactly its grid', () => {
  const dials = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(readoutCells(p, warn))).toBe(TILE * (NH / 2) * 12)
    expect(size(readoutCells(p, warn, 34))).toBe(34 * (NH / 2) * 12)
    for (const d of dials) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
  }
})

test('the number changes and a warned readout is marked', () => {
  expect(readoutCells(37)).not.toBe(readoutCells(84))
  expect(readoutCells(undefined)).not.toBe(readoutCells(0))
  expect(readoutCells(62, true)).not.toBe(readoutCells(62, false))
})

test('the digital theme draws the pane', { options: { theme: 'digital' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

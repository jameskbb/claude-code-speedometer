import { expect, mock, test } from 'claude-code/testing'

import { bankCells, BW, ROWS, scannerCells, SCW, theme, voiceCells, VW } from '../hooks/themes/scanner-dash'

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

test('each scanner-dash painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(voiceCells(p, warn))).toBe(VW * ROWS * 12)
    expect(size(bankCells(p, warn))).toBe(BW * ROWS * 12)
    expect(size(bankCells(p, warn, 7))).toBe(BW * ROWS * 12)
    expect(size(scannerCells(p))).toBe(SCW * 1 * 12)
  }
  const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned scanner-dash window paints differently', () => {
  expect(voiceCells(62, true)).not.toBe(voiceCells(62, false))
  expect(bankCells(84, true)).not.toBe(bankCells(84, false))
  expect(voiceCells(62)).not.toBe(voiceCells(37))
  expect(scannerCells(42)).not.toBe(scannerCells(84))
})

test('the scanner-dash theme draws the pane', { options: { theme: 'scanner-dash' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

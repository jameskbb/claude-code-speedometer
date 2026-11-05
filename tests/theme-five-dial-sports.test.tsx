import { expect, mock, test } from 'claude-code/testing'

import { clusterCells, comboCells, CR, CW, OW, sideCells, smallCells, SW, tachCells, theme, TW } from '../hooks/themes/five-dial-sports'

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

test('each five-dial-sports gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(tachCells(p, warn))).toBe(TW * (TW / 2) * 12)
    expect(size(sideCells(p, warn))).toBe(SW * (SW / 2) * 12)
    expect(size(smallCells(p, warn))).toBe(OW * (OW / 2) * 12)
    expect(size(comboCells(p, p))).toBe(OW * (OW / 2) * 12)
    expect(size(clusterCells({ five: p, week: p, model: p, context: p, tools: 7, agents: 1, warn: [warn, warn, warn] }))).toBe(CW * CR * 12)
  }
  const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned five-dial-sports gauge paints differently', () => {
  expect(tachCells(62, true)).not.toBe(tachCells(62, false))
  expect(sideCells(84, true)).not.toBe(sideCells(84, false))
  const r = { five: 62, week: 37, model: 84, context: 42, tools: 7, agents: 1 }
  expect(clusterCells({ ...r, warn: [true, false, false] })).not.toBe(clusterCells({ ...r, warn: [false, false, false] }))
})

test('the five-dial-sports theme draws the pane', { options: { theme: 'five-dial-sports' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

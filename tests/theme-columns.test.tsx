import { expect, mock, test } from 'claude-code/testing'

import { COLW, columnCells, SEGS, theme } from '../hooks/themes/columns'

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

test('each column fills exactly its grid', () => {
  const dials = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'model' })
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    for (const d of dials) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
    expect(size(columnCells(p, warn))).toBe(COLW * SEGS * 12)
    expect(size(columnCells(p, warn, 6, 10))).toBe(6 * 10 * 12)
  }
})

test('the level moves and a warned column is marked', () => {
  expect(columnCells(20)).not.toBe(columnCells(70))
  expect(columnCells(undefined)).not.toBe(columnCells(0))
  expect(columnCells(62, true)).not.toBe(columnCells(62, false))
  expect(columnCells(100, true)).not.toBe(columnCells(100, false))
})

test('the columns theme draws the pane', { options: { theme: 'columns' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

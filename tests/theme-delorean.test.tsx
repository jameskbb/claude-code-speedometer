import { expect, mock, test } from 'claude-code/testing'

import { moment, rowCells, RR, RW, theme, TUBES } from '../hooks/themes/delorean'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: {
    title: 'Speedometer',
    isFocused: false,
    bodyColumns: 90,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length
const AT = moment(new Date(2 * 3_600_000 + 14 * 60_000).toISOString())

test('each delorean row fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    for (const tube of TUBES) {
      expect(size(rowCells(p, warn, tube, AT))).toBe(RW * RR * 12)
      expect(size(rowCells(p, warn, tube))).toBe(RW * RR * 12)
    }
  }
  const resetsAt = new Date(0).toISOString()
  const [five, week, model] = theme.gauges(
    { label: '5-hour', limit: { kind: 'session', label: '5-hour', percent: 62, resetsAt } },
    { label: 'weekly' },
    { label: 'Fable weekly' },
  )
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned delorean row paints differently', () => {
  expect(rowCells(62, true, TUBES[0], AT)).not.toBe(rowCells(62, false, TUBES[0], AT))
  expect(rowCells(84, true, TUBES[2])).not.toBe(rowCells(84, false, TUBES[2]))
  expect(rowCells(62, false, TUBES[0], AT)).not.toBe(rowCells(37, false, TUBES[0], AT))
})

test('the reset moment reads from resetsAt alone', () => {
  expect(moment(undefined)).toBeUndefined()
  expect(moment('not a date')).toBeUndefined()
  expect(AT).toBeDefined()
  expect(rowCells(62, false, TUBES[0], AT)).not.toBe(rowCells(62, false, TUBES[0]))
})

test('the delorean theme draws the pane', { options: { theme: 'delorean' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

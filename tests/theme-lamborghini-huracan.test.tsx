import { expect, mock, test } from 'claude-code/testing'

import { AR, AW, leftArcCells, revCells, rightArcCells, RW, theme } from '../hooks/themes/lamborghini-huracan'

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

test('each huracan gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(revCells(p, warn))).toBe(RW * (RW / 2) * 12)
    expect(size(leftArcCells(p, warn))).toBe(AW * AR * 12)
    expect(size(rightArcCells(p, warn))).toBe(AW * AR * 12)
  }
  const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned huracan gauge paints differently', () => {
  expect(revCells(62, true)).not.toBe(revCells(62, false))
  expect(leftArcCells(37, true)).not.toBe(leftArcCells(37, false))
  expect(rightArcCells(84, true)).not.toBe(rightArcCells(84, false))
})

test('the lamborghini-huracan theme draws the pane', { options: { theme: 'lamborghini-huracan' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

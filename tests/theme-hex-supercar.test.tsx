import { expect, mock, test } from 'claude-code/testing'

import { AR, AW, leftArcCells, mode, revCells, rightArcCells, RW, theme } from '../hooks/themes/hex-supercar'

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

test('each hex-supercar gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(revCells(p, warn))).toBe(RW * (RW / 2) * 12)
    expect(size(leftArcCells(p, warn))).toBe(AW * AR * 12)
    expect(size(rightArcCells(p, warn))).toBe(AW * AR * 12)
  }
  const [five, week, model] = theme.gauges({ label: '5-hour' }, { label: 'weekly' }, { label: 'Fable weekly' })
  for (const d of [five, week, model]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('the hex-supercar drive modes are road, sport and track', () => {
  expect([0, 49, 50, 79, 80, 100].map(p => mode(p).name)).toEqual(['ROAD', 'ROAD', 'SPORT', 'SPORT', 'TRACK', 'TRACK'])
})

test('a warned hex-supercar gauge paints differently', () => {
  expect(revCells(62, true)).not.toBe(revCells(62, false))
  expect(leftArcCells(37, true)).not.toBe(leftArcCells(37, false))
  expect(rightArcCells(84, true)).not.toBe(rightArcCells(84, false))
})

test('the hex-supercar theme draws the pane', { options: { theme: 'hex-supercar' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

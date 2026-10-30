import { expect, mock, test } from 'claude-code/testing'

import { knobCells, ladderCells, LR, LW, meterCells, VR, VW } from '../hooks/themes/vu-meter'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('the vu-meter painters fill exactly their grids', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(meterCells(p, warn))).toBe(VW * VR * 12)
    expect(size(ladderCells(p, warn))).toBe(LW * LR * 12)
  }
  expect(size(knobCells())).toBe(LW * 3 * 12)
  // A warned window lights the peak LED, so its pixels differ.
  expect(meterCells(62, true)).not.toBe(meterCells(62, false))
  expect(ladderCells(37, true)).not.toBe(ladderCells(37, false))
})

test('the vu-meter theme draws the pane', { options: { theme: 'vu-meter' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /PEAK/ })).toBeDefined()
  await ui.unmount()
})

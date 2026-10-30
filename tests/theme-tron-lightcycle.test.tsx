import { expect, mock, test } from 'claude-code/testing'

import { bigRing, FLOOR, floorCells, FR, modelRing, RB, ringCells, RS, sideRing } from '../hooks/themes/tron-lightcycle'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('each tron-lightcycle ring and the floor fill exactly their grids', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [100, false], [140, true]] as const) {
    expect(size(bigRing(p, warn))).toBe(RB * (RB / 2) * 12)
    expect(size(sideRing(p, warn))).toBe(RS * (RS / 2) * 12)
    expect(size(modelRing(p, warn))).toBe(RS * (RS / 2) * 12)
    expect(size(floorCells(FLOOR, p, p))).toBe(FLOOR * FR * 12)
  }
  expect(size(ringCells(12, 50, true))).toBe(12 * 6 * 12)
  expect(size(floorCells(40, undefined, 100))).toBe(40 * FR * 12)
})

test('the tron-lightcycle theme draws the pane', { options: { theme: 'tron-lightcycle' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

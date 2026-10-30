import { expect, mock, test } from 'claude-code/testing'

import { barometerCells, BW, HW, hygrometerCells, thermometerCells, TR, TW } from '../hooks/themes/weather-station'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('the weather-station painters fill exactly their grids', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(thermometerCells(p, warn))).toBe(TW * TR * 12)
    expect(size(barometerCells(p, warn))).toBe(BW * (BW / 2) * 12)
    expect(size(hygrometerCells(p, warn))).toBe(HW * (HW / 2) * 12)
  }
  // A warned window carries a red mark, so its pixels differ.
  expect(thermometerCells(62, true)).not.toBe(thermometerCells(62, false))
  expect(barometerCells(37, true)).not.toBe(barometerCells(37, false))
  expect(hygrometerCells(84, true)).not.toBe(hygrometerCells(84, false))
})

test('the weather-station theme draws the pane', { options: { theme: 'weather-station' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /BAROMETER/ })).toBeDefined()
  await ui.unmount()
})

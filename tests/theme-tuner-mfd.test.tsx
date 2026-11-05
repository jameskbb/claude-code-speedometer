import { expect, mock, test } from 'claude-code/testing'

import { BARW, barCells, BROWS, GW, roundCells } from '../hooks/themes/tuner-mfd'

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
const READINGS: [number | undefined, boolean][] = [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]]

test('a round gauge fills exactly its grid', () => {
  for (const w of [GW, 18]) {
    for (const [p, warn] of READINGS) expect(size(roundCells(p, warn, w))).toBe(w * (w / 2) * 12)
    // A warned gauge draws differently from the same gauge unwarned.
    expect(roundCells(62, true, w)).not.toBe(roundCells(62, false, w))
    expect(roundCells(62, false, w)).not.toBe(roundCells(37, false, w))
  }
})

test('a bar graph fills exactly its grid', () => {
  for (const w of [BARW, 24]) {
    for (const [p, warn] of READINGS) expect(size(barCells(p, warn, w))).toBe(w * BROWS * 12)
    expect(barCells(62, true, w)).not.toBe(barCells(62, false, w))
    expect(barCells(62, false, w)).not.toBe(barCells(37, false, w))
  }
})

test('the tuner-mfd theme draws the pane too', { options: { theme: 'tuner-mfd' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'

import { batteryCells, BH, BW, theme } from '../hooks/themes/battery'

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

test('each battery fills exactly its grid', () => {
  const dials = theme.gauges({ label: 'a' }, { label: 'b' }, { label: 'c' })
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    for (const d of dials) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
    expect(size(batteryCells(p, warn))).toBe(BW * (BH / 2) * 12)
  }
})

test('the charge drains and a warned battery is marked', () => {
  expect(batteryCells(20)).not.toBe(batteryCells(70))
  expect(batteryCells(undefined)).not.toBe(batteryCells(0))
  expect(batteryCells(62, true)).not.toBe(batteryCells(62, false))
})

test('the battery theme draws the pane', { options: { theme: 'battery' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

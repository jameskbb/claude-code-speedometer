import { expect, mock, test } from 'claude-code/testing'

import { theme } from '../hooks/themes/bars'

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

const dials = theme.gauges(
  { label: '5-hour' },
  { label: 'weekly' },
  { label: 'Fable weekly' },
)

test('each bar fills exactly its grid', () => {
  for (const d of dials) {
    for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
      expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
    }
  }
})

test('the bar moves and a warned bar is capped', () => {
  for (const d of dials) {
    expect(d.cells(20, false)).not.toBe(d.cells(70, false))
    expect(d.cells(undefined, false)).not.toBe(d.cells(37, false))
    expect(d.cells(62, true)).not.toBe(d.cells(62, false))
  }
})

test('the bars theme draws the pane', { options: { theme: 'bars' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

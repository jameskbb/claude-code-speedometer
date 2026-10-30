import { expect, mock, test } from 'claude-code/testing'

import { cut, N, ringCells } from '../hooks/themes/rings'

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

test('each ring fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(ringCells(p, warn))).toBe(N * (N / 2) * 12)
    expect(size(ringCells(p, warn, 22, 4))).toBe(22 * 11 * 12)
  }
})

test('the ring fills and a warned ring wears a bead', () => {
  expect(ringCells(20)).not.toBe(ringCells(70))
  expect(ringCells(undefined)).not.toBe(ringCells(0))
  expect(ringCells(62, true)).not.toBe(ringCells(62, false))
  expect(ringCells(84, true)).not.toBe(ringCells(84, false))
})

test('a cut keeps its block of cells', () => {
  const cells = ringCells(62, true)
  expect(size(cut(cells, N, 0, 4, 3, 1))).toBe(3 * 12)
  expect(cut(cells, N, 0, 0, N, N / 2)).toBe(cells)
})

test('the rings theme draws the pane', { options: { theme: 'rings' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

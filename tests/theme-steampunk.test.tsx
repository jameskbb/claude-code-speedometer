import { expect, mock, test } from 'claude-code/testing'

import { BW, boilerCells, GH, GW, valveCells, whistleCells } from '../hooks/themes/steampunk'

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

test('each steampunk gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(boilerCells(p, warn))).toBe(BW * (GH / 2) * 12)
    expect(size(whistleCells(p, warn))).toBe(GW * (GH / 2) * 12)
    expect(size(valveCells(p, warn))).toBe(GW * (GH / 2) * 12)
  }
})

test('a warned gauge paints differently', () => {
  expect(boilerCells(62, true)).not.toBe(boilerCells(62, false))
  expect(whistleCells(62, true)).not.toBe(whistleCells(62, false))
  expect(valveCells(62, true)).not.toBe(valveCells(62, false))
})

test('the steampunk theme draws the pane', { options: { theme: 'steampunk' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

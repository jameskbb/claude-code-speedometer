import { expect, mock, test } from 'claude-code/testing'

import { BIG, bigGlass, glassCells, SMALL, smallGlass } from '../hooks/themes/hourglass'

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

test('each glass fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(bigGlass(p, warn))).toBe(BIG.w * (BIG.h / 2) * 12)
    expect(size(smallGlass(p, warn))).toBe(SMALL.w * (SMALL.h / 2) * 12)
    expect(size(glassCells(9, 14, p, warn))).toBe(9 * 7 * 12)
  }
})

test('the sand moves and a warned glass is sealed', () => {
  expect(bigGlass(20)).not.toBe(bigGlass(70))
  expect(bigGlass(undefined)).not.toBe(bigGlass(0))
  expect(smallGlass(62, true)).not.toBe(smallGlass(62, false))
})

test('the hourglass theme draws the pane', { options: { theme: 'hourglass' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

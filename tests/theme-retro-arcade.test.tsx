import { expect, mock, test } from 'claude-code/testing'

import { AROWS, AW, health, heartsCells } from '../hooks/themes/retro-arcade'

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

test('an arcade card fills exactly its grid', () => {
  for (const p of [undefined, 0, 37, 62, 84, 100, 140]) {
    expect(size(heartsCells(p))).toBe(AW * AROWS * 12)
    expect(size(heartsCells(p, true))).toBe(AW * AROWS * 12)
  }
})

test('health is what is left of the window', () => {
  expect(health(undefined)).toBe(-1)
  expect(health(0)).toBe(1)
  expect(Math.round(health(62) * 100)).toBe(38)
  expect(health(150)).toBe(0)
  // A warned card draws differently from the same card unwarned.
  expect(heartsCells(62, true)).not.toBe(heartsCells(62, false))
  expect(heartsCells(62)).not.toBe(heartsCells(37))
})

test('the retro-arcade theme draws the pane too', { options: { theme: 'retro-arcade' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /INSERT COIN/ })).toBeDefined()
  await ui.unmount()
})

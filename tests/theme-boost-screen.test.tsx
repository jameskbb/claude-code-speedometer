import { expect, mock, test } from 'claude-code/testing'

import { dials } from '../hooks/register'

import { BARW, barCells, BROWS, GW, roundCells } from '../hooks/themes/boost-screen'

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

test('the boost-screen theme draws the pane too', { options: { theme: 'boost-screen' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// week pace on the second. The weekly window resets two days after the
// mock clock's 0, so five of its seven days have passed: week pace reads 71%.
const NO_FIVE = [
  { kind: 'weekly_all', label: 'weekly', percent: 30, resetsAt: new Date(2 * 86_400_000).toISOString() },
  { kind: 'weekly_scoped', label: 'Fable weekly', percent: 10 },
]
const plan = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const seeded: Record<string, unknown> = {
    limits: { shape: 'limits-1', value: NO_FIVE },
    usage: { shape: 'usage-1', value: { percent: 42, tokens: 84000, window: 200000, rateLimits: [], usd: 1.23 } },
  }
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    return e.key in seeded ? { value: { value: seeded[e.key], version: 0 } } : own
  })
}

test('boost-screen binds the slots in order, whatever each shows', () => {
  const [main, second, third] = dials(NO_FIVE, 'boost-screen', ['auto', 'auto', 'auto'], 42, false, false, 0)
  expect([main?.source, main?.label, main?.limit?.percent]).toEqual(['weekly', 'weekly', 30])
  expect([second?.source, second?.label, second?.limit?.percent]).toEqual(['week-pace', 'week pace', 71])
  expect([third?.source, third?.label]).toEqual(['model-weekly', 'Fable weekly'])
  expect(main).toMatchObject({ w: GW })
  expect(second).toMatchObject({ w: BARW })
})

test('boost-screen on a plan with no 5-hour window: weekly on the main gauge, week pace on the second', { options: { theme: 'boost-screen' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^30%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^week pace$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^71%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Fable weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^10%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('boost-screen draws any source in any slot', { options: { theme: 'boost-screen', gauge1: 'context', gauge2: 'five-hour', gauge3: 'context' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

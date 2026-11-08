import { expect, mock, test } from 'claude-code/testing'

import { dials } from '../hooks/register'

import { GROWS, GW, ribbonCells, RIBW, ribsCells, roundCells, RROWS, RW, theme } from '../hooks/themes/fifties-chrome'

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

test('each fifties-chrome painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(ribbonCells(p, warn))).toBe(RW * RROWS * 12)
    expect(size(roundCells(p, warn))).toBe(GW * GROWS * 12)
  }
  expect(size(ribsCells())).toBe(RIBW * 1 * 12)
  const [main, second, third] = theme.gauges({ source: 'five-hour', label: '5-hour' }, { source: 'weekly', label: 'weekly' }, { source: 'context', label: 'context' })
  for (const d of [main, second, third]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned fifties-chrome gauge paints differently', () => {
  expect(ribbonCells(62, true)).not.toBe(ribbonCells(62, false))
  expect(roundCells(84, true)).not.toBe(roundCells(84, false))
  expect(ribbonCells(37)).not.toBe(ribbonCells(62))
})

test('the fifties-chrome theme draws the pane', { options: { theme: 'fifties-chrome' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// week pace on the second. The weekly window resets 2 days in.
const WEEK = 7 * 86_400_000
// How far through the weekly window the clock is, as the week pace gauge reads it.
const pace = (resetsAt: string, now: number) => Math.round((1 - (Date.parse(resetsAt) - now) / WEEK) * 100)
const NO_FIVE = [
  { kind: 'weekly_all', label: 'weekly', percent: 30, resetsAt: new Date(2 * 86_400_000).toISOString() },
  { kind: 'weekly_scoped', label: 'Fable weekly', percent: 10 },
]
const plan = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  const clock = mock.clock(on)
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
  return clock
}

test('fifties-chrome binds the slots in order, whatever each shows', () => {
  // At the epoch, 2 days are left of the week: 71% of it has passed.
  const [main, second, third] = dials(NO_FIVE, 'fifties-chrome', ['auto', 'auto', 'auto'], 42, false, false, 0)
  expect([main?.source, main?.label, main?.limit?.percent]).toEqual(['weekly', 'weekly', 30])
  expect([second?.source, second?.label, second?.limit?.percent]).toEqual(['week-pace', 'week pace', 71])
  expect(second?.limit?.resetsAt).toBe(NO_FIVE[0]!.resetsAt)
  expect([third?.source, third?.label]).toEqual(['model-weekly', 'Fable weekly'])
  expect(main).toMatchObject({ w: RW })
  expect(second).toMatchObject({ w: GW })
})

test('fifties-chrome on a plan with no 5-hour window: weekly on the main gauge, week pace on the second', { options: { theme: 'fifties-chrome' } }, async ($, on) => {
  const clock = plan(on)
  const p = pace(NO_FIVE[0]!.resetsAt, clock.now())
  expect(p).toBe(71)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^30%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^week pace$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: new RegExp(`^${p}%$`) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^context$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Fable weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('fifties-chrome draws any source in any slot', { options: { theme: 'fifties-chrome', gauge1: 'context', gauge2: 'five-hour', gauge3: 'context' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

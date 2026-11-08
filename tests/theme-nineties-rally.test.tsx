import { expect, mock, test } from 'claude-code/testing'

import { dials } from '../hooks/register'

import { clusterCells, CR, CW, rallyCells, mainCells, smallCells, tachCells } from '../hooks/themes/nineties-rally'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length
const CASES = [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const

test('each nineties-rally painter fills exactly its grid', () => {
  for (const [p, warn] of CASES) {
    expect(size(tachCells(p, warn))).toBe(24 * 12 * 12)
    expect(size(mainCells(p, warn))).toBe(18 * 9 * 12)
    expect(size(smallCells(p, warn))).toBe(10 * 5 * 12)
    expect(size(rallyCells(14, p, warn))).toBe(14 * 7 * 12)
    const r = { main: p, second: p, third: p, context: p, tools: 7, agents: 1, warn: [warn, warn, warn] as [boolean, boolean, boolean] }
    expect(size(clusterCells(r))).toBe(CW * CR * 12)
    expect(size(clusterCells(r, 60, 10))).toBe(60 * 10 * 12)
  }
})

test('a warned nineties-rally gauge draws differently', () => {
  expect(tachCells(62, true)).not.toBe(tachCells(62, false))
  expect(mainCells(62, true)).not.toBe(mainCells(62, false))
  const r = { main: 62, second: 37, third: 84, context: 42, tools: 7, agents: 1 }
  expect(clusterCells({ ...r, warn: [true, false, false] })).not.toBe(clusterCells({ ...r, warn: [false, false, false] }))
})

test('the nineties-rally theme draws the pane', { options: { theme: 'nineties-rally' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// week pace on the second.
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
// How far through the weekly window the clock is, as the week-pace dial reads it.
const pace = (resetsAt: string, now: number) => Math.round(Math.max(0, Math.min(1, 1 - (Date.parse(resetsAt) - now) / (7 * 86_400_000))) * 100)

test('nineties-rally binds the slots in order, whatever each shows', () => {
  // Two days before the weekly reset: 5 of the week's 7 days have gone.
  const [main, second, third] = dials(NO_FIVE, 'nineties-rally', ['auto', 'auto', 'auto'], 42, false, false, 0)
  expect([main?.source, main?.label, main?.limit?.percent]).toEqual(['weekly', 'weekly', 30])
  expect([second?.source, second?.label, second?.limit?.percent]).toEqual(['week-pace', 'week pace', 71])
  expect([third?.source, third?.label]).toEqual(['model-weekly', 'Fable weekly'])
  expect(main).toMatchObject({ w: 24 })
  expect(second).toMatchObject({ w: 18 })
})

test('nineties-rally on a plan with no 5-hour window: weekly on the main gauge, week pace on the second', { options: { theme: 'nineties-rally' } }, async ($, on) => {
  const clock = plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /30% weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: new RegExp(`${pace(NO_FIVE[0]!.resetsAt, clock.now())}% week pace`) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /42% context/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /10% Fable weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('nineties-rally draws any source in any slot', { options: { theme: 'nineties-rally', gauge1: 'context', gauge2: 'five-hour', gauge3: 'context' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

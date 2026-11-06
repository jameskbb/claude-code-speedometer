import { expect, mock, test } from 'claude-code/testing'

import { dials } from '../hooks/register'

import { moment, rowCells, RR, RW, theme, TUBES } from '../hooks/themes/chrono-console'

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
const AT = moment(new Date(2 * 3_600_000 + 14 * 60_000).toISOString())

test('each chrono-console row fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    for (const tube of TUBES) {
      expect(size(rowCells(p, warn, tube, AT))).toBe(RW * RR * 12)
      expect(size(rowCells(p, warn, tube))).toBe(RW * RR * 12)
    }
  }
  const resetsAt = new Date(0).toISOString()
  const [main, second, third] = theme.gauges(
    { source: 'five-hour', label: '5-hour', limit: { kind: 'session', label: '5-hour', percent: 62, resetsAt } },
    { source: 'context', label: 'context', limit: { kind: 'context', label: 'context', percent: 42 } },
    { source: 'model-weekly', label: 'Fable weekly' },
  )
  for (const d of [main, second, third]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned chrono-console row paints differently', () => {
  expect(rowCells(62, true, TUBES[0], AT)).not.toBe(rowCells(62, false, TUBES[0], AT))
  expect(rowCells(84, true, TUBES[2])).not.toBe(rowCells(84, false, TUBES[2]))
  expect(rowCells(62, false, TUBES[0], AT)).not.toBe(rowCells(37, false, TUBES[0], AT))
})

test('the reset moment reads from resetsAt alone', () => {
  expect(moment(undefined)).toBeUndefined()
  expect(moment('not a date')).toBeUndefined()
  expect(AT).toBeDefined()
  expect(rowCells(62, false, TUBES[0], AT)).not.toBe(rowCells(62, false, TUBES[0]))
})

test('the chrono-console theme draws the pane', { options: { theme: 'chrono-console' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// context fill on the second.
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

test('chrono-console binds the slots in order, whatever each shows', () => {
  const [main, second, third] = dials(NO_FIVE, 'chrono-console', ['auto', 'auto', 'auto'], 42)
  expect([main?.source, main?.label, main?.limit?.percent]).toEqual(['weekly', 'weekly', 30])
  expect([second?.source, second?.label, second?.limit?.percent]).toEqual(['context', 'context', 42])
  expect([third?.source, third?.label]).toEqual(['model-weekly', 'Fable weekly'])
  expect(main).toMatchObject({ w: RW })
  expect(second).toMatchObject({ w: RW })
})

test('chrono-console on a plan with no 5-hour window: weekly on the main gauge, context on the second', { options: { theme: 'chrono-console' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: / WEEKLY / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / 30%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / CONTEXT / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / 42%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / FABLE WEEKLY / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('chrono-console draws any source in any slot', { options: { theme: 'chrono-console', gauge1: 'context', gauge2: 'five-hour', gauge3: 'context' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

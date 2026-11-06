import { expect, mock, test } from 'claude-code/testing'

import { dials } from '../hooks/register'

import { bankCells, BW, ROWS, scannerCells, SCW, theme, voiceCells, VW } from '../hooks/themes/scanner-dash'

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

test('each scanner-dash painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(voiceCells(p, warn))).toBe(VW * ROWS * 12)
    expect(size(bankCells(p, warn))).toBe(BW * ROWS * 12)
    expect(size(bankCells(p, warn, 7))).toBe(BW * ROWS * 12)
    expect(size(scannerCells(p))).toBe(SCW * 1 * 12)
  }
  const [main, second, third] = theme.gauges({ source: 'five-hour', label: '5-hour' }, { source: 'weekly', label: 'weekly' }, { source: 'context', label: 'context' })
  for (const d of [main, second, third]) expect(size(d.cells(50, true))).toBe(d.w * d.rows * 12)
})

test('a warned scanner-dash window paints differently', () => {
  expect(voiceCells(62, true)).not.toBe(voiceCells(62, false))
  expect(bankCells(84, true)).not.toBe(bankCells(84, false))
  expect(voiceCells(62)).not.toBe(voiceCells(37))
  expect(scannerCells(42)).not.toBe(scannerCells(84))
})

test('the scanner-dash theme draws the pane', { options: { theme: 'scanner-dash' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  for (const mode of ['STANDBY', 'CRUISE', 'ALERT']) expect(await ui.find({ type: 'Text', text: new RegExp(` ${mode} `) })).toBeDefined()
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

test('scanner-dash binds the slots in order, whatever each shows', () => {
  const [main, second, third] = dials(NO_FIVE, 'scanner-dash', ['auto', 'auto', 'auto'], 42)
  expect([main?.source, main?.label, main?.limit?.percent]).toEqual(['weekly', 'weekly', 30])
  expect([second?.source, second?.label, second?.limit?.percent]).toEqual(['context', 'context', 42])
  expect([third?.source, third?.label]).toEqual(['model-weekly', 'Fable weekly'])
  expect(main).toMatchObject({ w: VW })
  expect(second).toMatchObject({ w: BW })
})

test('scanner-dash on a plan with no 5-hour window: weekly on the main gauge, context on the second', { options: { theme: 'scanner-dash' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /30% weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /42% context/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /10% Fable weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('scanner-dash draws any source in any slot', { options: { theme: 'scanner-dash', gauge1: 'context', gauge2: 'five-hour', gauge3: 'context' } }, async ($, on) => {
  plan(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'

import { gripCells, GR, GW, lcdCells, LW, MR, MW, rotaryCells, RW, theme, wheelCells } from '../hooks/themes/race-wheel'

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

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// context on the second, with the model's weekly window on the third.
const NO_FIVE: Record<string, { value: unknown; version: number }> = {
  warnings: { value: { shape: 'warnings-1', value: { weekly_all: 90 * 60_000 } }, version: 0 },
  limits: {
    value: {
      shape: 'limits-1',
      value: [
        { kind: 'weekly_all', label: 'weekly', percent: 30, resetsAt: new Date(2 * 3600_000 + 14 * 60_000).toISOString() },
        { kind: 'weekly_scoped', label: 'Fable weekly', percent: 10 },
      ],
    },
    version: 0,
  },
  usage: { value: { shape: 'usage-1', value: { percent: 42, tokens: 84000, window: 200000, rateLimits: [], usd: 1.23 } }, version: 0 },
}
const seedNoFive = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    const s = NO_FIVE[e.key]
    return s ? { value: s } : own
  })
}
// Every Text's string in the drawn tree, in drawing order.
type Node = { type?: string; children?: unknown[] }
const flat = (n: unknown): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' ? ((n as Node).children ?? []).map(flat).join('') : '')
const texts = (n: unknown): string[] => {
  if (!n || typeof n !== 'object') return []
  const node = n as Node
  if (node.type === 'Text') return [flat(node)]
  return (node.children ?? []).flatMap(texts)
}

test('each race-wheel painter fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(lcdCells(p, warn))).toBe(LW * 9 * 12)
    expect(size(rotaryCells(0x2b6cff)(p, warn))).toBe(RW * (RW / 2) * 12)
    expect(size(wheelCells({ main: p, second: p, third: p, warn: [warn, warn, warn] }))).toBe(MW * MR * 12)
    const [main, second, third] = theme.gauges({ source: 'five-hour', label: '5-hour' }, { source: 'weekly', label: 'weekly' }, { source: 'context', label: 'context' })
    for (const d of [main, second, third]) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
  }
  expect(size(gripCells(false))).toBe(GW * GR * 12)
  expect(size(gripCells(true))).toBe(GW * GR * 12)
})

test('a warned race-wheel paints differently', () => {
  expect(lcdCells(62, true)).not.toBe(lcdCells(62, false))
  expect(rotaryCells(0xff7a1a)(84, true)).not.toBe(rotaryCells(0xff7a1a)(84, false))
  const r = { main: 62, second: 37, third: 84 }
  for (const warn of [[true, false, false], [false, true, false], [false, false, true]] as [boolean, boolean, boolean][]) {
    expect(wheelCells({ ...r, warn })).not.toBe(wheelCells({ ...r, warn: [false, false, false] }))
  }
  expect(lcdCells(62)).not.toBe(lcdCells(37))
})

test('the race-wheel theme draws the pane', { options: { theme: 'race-wheel' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

test('race-wheel on a plan with no 5-hour window: weekly on the main gauge, context on the second', { options: { theme: 'race-wheel' } }, async ($, on) => {
  seedNoFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const t = texts(await ui.drawn())
  expect(t.some(s => /undefined|NaN/.test(s))).toBe(false)
  // Left to right: the second gauge, the main gauge, the third; each percent sits above its label.
  const at = (label: string) => t.findIndex(s => s === label)
  expect(at('context')).toBeGreaterThan(-1)
  expect(t[at('context') - 1]).toBe('42%')
  expect(t[at('weekly') - 1]).toBe('30%')
  expect(t[at('Fable weekly') - 1]).toBe('10%')
  expect(at('context')).toBeLessThan(at('weekly'))
  expect(at('weekly')).toBeLessThan(at('Fable weekly'))
  // Only the weekly window is warned; the context dial never is.
  expect(t.filter(s => /empty in 1h30m/.test(s)).length).toBe(1)
  expect(t.some(s => /↻ 2h14m/.test(s))).toBe(true)
  await ui.unmount()
})

test('race-wheel draws any source in any slot', { options: { theme: 'race-wheel', gauge1: 'context', gauge2: 'context', gauge3: 'five-hour' } }, async ($, on) => {
  seedNoFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const t = texts(await ui.drawn())
  expect(t.some(s => /undefined|NaN/.test(s))).toBe(false)
  expect(t.some(s => /no reading/.test(s))).toBe(true)
  expect(t.some(s => /empty in/.test(s))).toBe(false)
  await ui.unmount()
})

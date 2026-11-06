import { expect, mock, test } from 'claude-code/testing'

import { f40Cells, mainCells, MW, SM, smallCells, tachCells, TW } from '../hooks/themes/spartan-supercar'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
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

test('each spartan-supercar gauge fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [100, false], [140, true]] as const) {
    expect(size(tachCells(p, warn))).toBe(TW * (TW / 2) * 12)
    expect(size(mainCells(p, warn))).toBe(MW * (MW / 2) * 12)
    expect(size(smallCells(p, warn))).toBe(SM * (SM / 2) * 12)
  }
  expect(size(f40Cells(14, 50, true, Math.PI, 0, 4, 0.8))).toBe(14 * 7 * 12)
})

test('the spartan-supercar theme draws the pane', { options: { theme: 'spartan-supercar' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

test('spartan-supercar on a plan with no 5-hour window: weekly on the main gauge, context on the second', { options: { theme: 'spartan-supercar' } }, async ($, on) => {
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

test('spartan-supercar draws any source in any slot', { options: { theme: 'spartan-supercar', gauge1: 'context', gauge2: 'context', gauge3: 'five-hour' } }, async ($, on) => {
  seedNoFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const t = texts(await ui.drawn())
  expect(t.some(s => /undefined|NaN/.test(s))).toBe(false)
  expect(t.some(s => /no reading/.test(s))).toBe(true)
  expect(t.some(s => /empty in/.test(s))).toBe(false)
  await ui.unmount()
})

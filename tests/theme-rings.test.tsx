import { expect, mock, test } from 'claude-code/testing'

import { cut, N, ringCells } from '../hooks/themes/rings'

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

test('each ring fills exactly its grid', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(ringCells(p, warn))).toBe(N * (N / 2) * 12)
    expect(size(ringCells(p, warn, 22, 4))).toBe(22 * 11 * 12)
  }
})

test('the ring fills and a warned ring wears a bead', () => {
  expect(ringCells(20)).not.toBe(ringCells(70))
  expect(ringCells(undefined)).not.toBe(ringCells(0))
  expect(ringCells(62, true)).not.toBe(ringCells(62, false))
  expect(ringCells(84, true)).not.toBe(ringCells(84, false))
})

test('a cut keeps its block of cells', () => {
  const cells = ringCells(62, true)
  expect(size(cut(cells, N, 0, 4, 3, 1))).toBe(3 * 12)
  expect(cut(cells, N, 0, 0, N, N / 2)).toBe(cells)
})

test('the rings theme draws the pane', { options: { theme: 'rings' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: only the weekly windows, and context at 42%.
const WEEKLY_RESET = new Date(2 * 3600_000).toISOString()
// How far through the weekly window the clock is, as the week-pace dial reads it.
const pace = (resetsAt: string, now: number) => Math.round(Math.max(0, Math.min(1, 1 - (Date.parse(resetsAt) - now) / (7 * 86_400_000))) * 100)
const noFive = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  const clock = mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const resetsAt = WEEKLY_RESET
  const seeded: Record<string, { value: unknown; version: number }> = {
    limits: { value: { shape: 'limits-1', value: [{ kind: 'weekly_all', label: 'weekly', percent: 12, resetsAt }, { kind: 'weekly_scoped', label: 'Fable weekly', percent: 88 }] }, version: 0 },
    usage: { value: { shape: 'usage-1', value: { percent: 42, tokens: 84000, window: 200000, rateLimits: [], usd: 1.23 } }, version: 0 },
  }
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    const seed = seeded[e.key]
    return seed ? { value: seed } : own
  })
  return clock
}

// The drawn tree's strings, in order.
const texts = (n: any): string[] => (typeof n === 'string' ? [n] : n && typeof n === 'object' ? (n.children ?? []).flatMap(texts) : [])

test('with no 5-hour window the main gauge shows weekly and the second week pace', { options: { theme: 'rings' } }, async ($, on) => {
  const clock = noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const all = texts(tree)
  const text = all.join('|')
  expect(all.indexOf('weekly')).toBeGreaterThanOrEqual(0)
  expect(all.indexOf('weekly')).toBeLessThan(all.indexOf('week pace'))
  expect(all).not.toContain('context')
  // Two hours before the weekly reset: 99% of the week has gone.
  const p = `${pace(WEEKLY_RESET, clock.now())}%`
  expect(p).toBe('99%')
  expect(text.indexOf('12%')).toBeGreaterThanOrEqual(0)
  expect(text.indexOf('12%')).toBeLessThan(text.indexOf(p))
  expect(text).not.toMatch(/42%/)
  expect(text).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

test('two slots can show the same source', { options: { theme: 'rings', gauge1: 'context', gauge2: 'context', gauge3: 'model-weekly' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = texts(await ui.drawn())
  expect(all.filter(t => t === 'context').length).toBe(2)
  expect(all.join('|')).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

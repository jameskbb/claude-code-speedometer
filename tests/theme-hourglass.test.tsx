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

// The drawn tree: every string in a node, and the part of the tree that draws one slot.
type Drawn = { type?: string; props?: { key?: unknown }; children?: unknown[] }
const flat = (n: unknown): string => (typeof n === 'string' ? n : Array.isArray(n) ? n.map(flat).join('\n') : n && typeof n === 'object' ? flat((n as Drawn).children ?? []) : '')
const dialKeys = (n: unknown): string[] => {
  if (!n || typeof n !== 'object') return []
  const d = n as Drawn
  const own = d.type === 'Raster' && typeof d.props?.key === 'string' && d.props.key.startsWith('dial-') ? [d.props.key] : []
  return [...own, ...(d.children ?? []).flatMap(dialKeys)]
}
const byKey = (n: unknown, key: string): unknown => {
  if (!n || typeof n !== 'object') return undefined
  const d = n as Drawn
  if (d.props?.key === key) return d
  for (const c of d.children ?? []) { const f = byKey(c, key); if (f) return f }
  return undefined
}
// The outermost node that draws this slot's gauge and no other.
const column = (n: unknown, slot: string): unknown => {
  if (!n || typeof n !== 'object') return undefined
  const keys = dialKeys(n)
  if (keys.length === 1 && keys[0] === `dial-${slot}`) return n
  for (const c of (n as Drawn).children ?? []) { const f = column(c, slot); if (f) return f }
  return undefined
}

// A plan with no 5-hour window: weekly and the per-model weekly only, the weekly one warned.
const NO_FIVE: Record<string, { value: unknown; version: number }> = {
  warnings: { value: { shape: 'warnings-1', value: { weekly_all: 90 * 60_000 } }, version: 0 },
  limits: {
    value: {
      shape: 'limits-1',
      value: [
        { kind: 'weekly_all', label: 'weekly', percent: 30, resetsAt: new Date(3 * 24 * 3_600_000).toISOString() },
        { kind: 'weekly_scoped', label: 'Fable weekly', percent: 84 },
      ],
    },
    version: 0,
  },
  usage: { value: { shape: 'usage-1', value: { percent: 42, tokens: 84_000, window: 200_000, rateLimits: [], usd: 1.23 } }, version: 0 },
}

const seed = (on: Parameters<Parameters<typeof test>[1]>[1], seeded: Record<string, { value: unknown; version: number }>) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    const s = seeded[e.key]
    return s ? { value: s } : own
  })
}

const has = (n: unknown, re: RegExp) => re.test(flat(n))

test('hourglass on a plan with no 5-hour window: weekly in the main gauge, context in the second', { options: { theme: 'hourglass' } }, async ($, on) => {
  seed(on, NO_FIVE)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const [main, second, third] = (['main', 'second', 'third'] as const).map(s => byKey(tree, `legend-${s}`))
  expect(has(main, /weekly/i) && has(main, /30%/) && has(main, /empty in 1h30m/)).toBe(true)
  expect(has(second, /context/i) && has(second, /42%/)).toBe(true)
  expect(has(third, /Fable weekly/i) && has(third, /84%/)).toBe(true)
  expect(has(tree, /undefined|NaN/)).toBe(false)
  await ui.unmount()
})

test('hourglass draws a context gauge with no reading in the main slot', { options: { theme: 'hourglass', gauge1: 'context' } }, async ($, on) => {
  seed(on, { limits: NO_FIVE.limits! })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const main = (s => byKey(tree, `legend-${s}`))('main')
  expect(has(main, /context/i) && has(main, /––%/) && has(main, /no reading/)).toBe(true)
  expect(has(tree, /undefined|NaN/)).toBe(false)
  await ui.unmount()
})

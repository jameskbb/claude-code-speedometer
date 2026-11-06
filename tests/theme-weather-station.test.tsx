import { expect, mock, test } from 'claude-code/testing'

import { barometerCells, BW, HW, hygrometerCells, thermometerCells, TR, TW } from '../hooks/themes/weather-station'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length

test('the weather-station painters fill exactly their grids', () => {
  for (const [p, warn] of [[undefined, false], [0, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(thermometerCells(p, warn))).toBe(TW * TR * 12)
    expect(size(barometerCells(p, warn))).toBe(BW * (BW / 2) * 12)
    expect(size(hygrometerCells(p, warn))).toBe(HW * (HW / 2) * 12)
  }
  // A warned window carries a red mark, so its pixels differ.
  expect(thermometerCells(62, true)).not.toBe(thermometerCells(62, false))
  expect(barometerCells(37, true)).not.toBe(barometerCells(37, false))
  expect(hygrometerCells(84, true)).not.toBe(hygrometerCells(84, false))
})

test('the weather-station theme draws the pane', { options: { theme: 'weather-station' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /BAROMETER/ })).toBeDefined()
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

test('weather-station on a plan with no 5-hour window: weekly in the main gauge, context in the second', { options: { theme: 'weather-station' } }, async ($, on) => {
  seed(on, NO_FIVE)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const [main, second, third] = (['main', 'second', 'third'] as const).map(s => column(tree, s))
  expect(has(main, /weekly/i) && has(main, /30%/) && has(main, /empty in 1h30m/)).toBe(true)
  expect(has(second, /context/i) && has(second, /42%/)).toBe(true)
  expect(has(third, /Fable weekly/i) && has(third, /84%/)).toBe(true)
  expect(has(tree, /undefined|NaN/)).toBe(false)
  await ui.unmount()
})

test('weather-station draws a context gauge with no reading in the main slot', { options: { theme: 'weather-station', gauge1: 'context' } }, async ($, on) => {
  seed(on, { limits: NO_FIVE.limits! })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const main = (s => column(tree, s))('main')
  expect(has(main, /context/i) && has(main, /––%/) && has(main, /no reading/)).toBe(true)
  expect(has(tree, /undefined|NaN/)).toBe(false)
  await ui.unmount()
})

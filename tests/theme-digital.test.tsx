import { expect, mock, test } from 'claude-code/testing'

import { NH, readoutCells, theme, TILE } from '../hooks/themes/digital'

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

test('each readout fills exactly its grid', () => {
  const dials = theme.gauges({ source: 'five-hour', label: '5-hour' }, { source: 'weekly', label: 'weekly' }, { source: 'model-weekly', label: 'Fable weekly' })
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    expect(size(readoutCells(p, warn))).toBe(TILE * (NH / 2) * 12)
    expect(size(readoutCells(p, warn, 34))).toBe(34 * (NH / 2) * 12)
    for (const d of dials) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
  }
})

test('the number changes and a warned readout is marked', () => {
  expect(readoutCells(37)).not.toBe(readoutCells(84))
  expect(readoutCells(undefined)).not.toBe(readoutCells(0))
  expect(readoutCells(62, true)).not.toBe(readoutCells(62, false))
})

test('the digital theme draws the pane', { options: { theme: 'digital' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: only the weekly windows, the weekly one
// resetting 2 hours in, and context at 42%.
const RESETS_AT = new Date(2 * 3600_000).toISOString()
const WEEK = 7 * 86_400_000
// How far through the weekly window the clock is, as the week pace gauge reads it.
const pace = (resetsAt: string, now: number) => Math.round((1 - (Date.parse(resetsAt) - now) / WEEK) * 100)
const noFive = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  const clock = mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const resetsAt = RESETS_AT
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

// The drawn tree's strings in order, and a raster's cells by key.
const texts = (n: any): string[] => (typeof n === 'string' ? [n] : n && typeof n === 'object' ? (n.children ?? []).flatMap(texts) : [])
const raster = (n: any, key: string): string | undefined => {
  if (!n || typeof n !== 'object') return undefined
  if (n.type === 'Raster' && n.props?.key === key) return n.props.cells
  for (const c of n.children ?? []) { const r = raster(c, key); if (r) return r }
  return undefined
}

test('with no 5-hour window the main gauge shows weekly and the second week pace', { options: { theme: 'digital' } }, async ($, on) => {
  const clock = noFive(on)
  // 2 hours left of the week: 99% of it has passed.
  const p = pace(RESETS_AT, clock.now())
  expect(p).toBe(99)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const all = texts(tree)
  const text = all.join('|')
  expect(all.indexOf('weekly')).toBeGreaterThanOrEqual(0)
  expect(all.indexOf('weekly')).toBeLessThan(all.indexOf('week pace'))
  expect(all.indexOf('week pace')).toBeLessThan(all.indexOf('Fable weekly'))
  expect(all).not.toContain('context')
  expect(raster(tree, 'dial-0')).toBe(readoutCells(12))
  expect(raster(tree, 'dial-1')).toBe(readoutCells(p))
  expect(raster(tree, 'dial-2')).toBe(readoutCells(88))
  expect(text).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

test('two slots can show the same source', { options: { theme: 'digital', gauge1: 'context', gauge2: 'context', gauge3: 'model-weekly' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = texts(await ui.drawn())
  expect(all.filter(t => t === 'context').length).toBe(2)
  expect(all.join('|')).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

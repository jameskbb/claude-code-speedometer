import { expect, mock, test } from 'claude-code/testing'

import { COLW, columnCells, SEGS, theme } from '../hooks/themes/columns'

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

test('each column fills exactly its grid', () => {
  const dials = theme.gauges({ source: 'five-hour', label: '5-hour' }, { source: 'weekly', label: 'weekly' }, { source: 'model-weekly', label: 'model' })
  for (const [p, warn] of [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const) {
    for (const d of dials) expect(size(d.cells(p, warn))).toBe(d.w * d.rows * 12)
    expect(size(columnCells(p, warn))).toBe(COLW * SEGS * 12)
    expect(size(columnCells(p, warn, 6, 10))).toBe(6 * 10 * 12)
  }
})

test('the level moves and a warned column is marked', () => {
  expect(columnCells(20)).not.toBe(columnCells(70))
  expect(columnCells(undefined)).not.toBe(columnCells(0))
  expect(columnCells(62, true)).not.toBe(columnCells(62, false))
  expect(columnCells(100, true)).not.toBe(columnCells(100, false))
})

test('the columns theme draws the pane', { options: { theme: 'columns' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// A plan with no 5-hour window: only the weekly windows, and context at 42%.
// The weekly window resets at 02:00 and the mock clock reads 00:00, so
// 166 of its 168 hours have passed: week pace reads 99%.
const noFive = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const resetsAt = new Date(2 * 3600_000).toISOString()
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
}

// The drawn tree's strings, in order.
const texts = (n: any): string[] => (typeof n === 'string' ? [n] : n && typeof n === 'object' ? (n.children ?? []).flatMap(texts) : [])

test('with no 5-hour window the main gauge shows weekly and the second week pace', { options: { theme: 'columns' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = await ui.drawn()
  const all = texts(tree)
  const text = all.join('|')
  expect(all.indexOf('weekly')).toBeGreaterThanOrEqual(0)
  expect(all.indexOf('weekly')).toBeLessThan(all.indexOf('week pace'))
  expect(text.indexOf('12%')).toBeGreaterThanOrEqual(0)
  expect(text.indexOf('12%')).toBeLessThan(text.indexOf('99%'))
  expect(text.indexOf('99%')).toBeLessThan(text.indexOf('88%'))
  expect(text).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

test('two slots can show the same source', { options: { theme: 'columns', gauge1: 'context', gauge2: 'context', gauge3: 'model-weekly' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = texts(await ui.drawn())
  expect(all.filter(t => t === 'context').length).toBe(2)
  expect(all.join('|')).not.toMatch(/undefined|NaN/)
  await ui.unmount()
})

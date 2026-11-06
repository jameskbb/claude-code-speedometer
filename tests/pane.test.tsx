import { expect, mock, test } from 'claude-code/testing'

import { afterWorking, barCells, categoryOf, dialCells, dialRows, dials, faceCells, FR, FW, minorCells, MJ, MN, parseHours, project, slotOf, sources, SR, SW, sweepCells, tachCells, THEMES, workingMs } from '../hooks/register'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: {
    title: 'Speedometer',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'speedometer',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

// What an earlier turn stored, seeded beneath the plugin; returns what fs.write was handed.
const seed = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const written: string[] = []
  on('fs.write', (_, e) => { written.push(`${e.path}=${e.text}`); return { value: undefined } })
  on('session.append', (_, e, next) => next(e))
  // At version 0, so the kit's own state takes the plugin's writes.
  const seeded: Record<string, { value: unknown; version: number }> = {
    ponytail: { value: 'full', version: 0 },
    warnings: { value: { shape: 'warnings-1', value: { session: 90 * 60_000 } }, version: 0 },
    agents: {
      value: {
        shape: 'agents-1',
        value: [
          { id: 'a1', type: 'Explore', description: 'find callers', model: 'claude-haiku-5-5', status: 'running', tokens: 64000, tools: 12, startedAt: 0 },
          { id: 'a2', type: 'general-purpose', description: 'write tests', model: 'claude-sonnet-5-5', status: 'done', tokens: 150000, tools: 3, startedAt: 0, endedAt: 64000 },
        ],
      },
      version: 0,
    },
    limits: {
      value: {
        shape: 'limits-1',
        value: [
          { kind: 'session', label: '5-hour', percent: 61.5, resetsAt: new Date(2 * 3600_000 + 14 * 60_000).toISOString() },
          { kind: 'weekly_all', label: 'weekly', percent: 12, resetsAt: new Date(2 * 3600_000 + 14 * 60_000).toISOString() },
          { kind: 'weekly_scoped', label: 'Fable weekly', percent: 88 },
        ],
      },
      version: 0,
    },
    usage: {
      value: { shape: 'usage-1', value: { percent: 42, tokens: 84000, window: 200000, rateLimits: [], usd: 1.23 } },
      version: 0,
    },
  }
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    const seed = seeded[e.key]
    return seed ? { value: seed } : own
  })

  return written
}

test('the pane draws the stored reading on every surface', async ($, on) => {
  const written = seed(on)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /61\.5%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Fable weekly/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /empty in 1h30m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↻ 2h14m/ })).toBeDefined()
    // The gauge clusters draw no facts rows: those are the minimal theme's.
    expect(await ui.find({ type: 'Text', text: /84k\/200k/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /cost/ })).toBeUndefined()
    await ui.unmount()

    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Text', text: /Fable weekly/ })).toBeUndefined()
    expect((await band.find({ type: 'Text', text: /ctx/ }))?.text).toContain('42%')
    expect(await band.find({ type: 'Text', text: /\$1\.23/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /1 agent/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /! 5-hour/ })).toBeDefined()
    // A press moves to the next level and writes ponytail's flags; the level persists across surfaces.
    const before = (await band.find({ type: 'Text', text: /ponytail (lite|full|ultra)/ }))?.text
    await band.press({ key: 'ponytail' })
    const after = (await band.find({ type: 'Text', text: /ponytail (lite|full|ultra)/ }))?.text
    expect(after).toBeDefined()
    expect(after).not.toBe(before)
    expect(written.some(w => w.replace(/\\/g, '/').includes('/.claude/.ponytail-active=') && w.endsWith(after?.split(' ')[1] ?? '?'))).toBe(true)
    written.length = 0
    await band.unmount()
  }
})

test('the minimal theme draws only the facts, on every surface', { options: { theme: 'minimal' } }, async ($, on) => {
  seed(on)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /84k\/200k/ }))?.text).toContain('42%')
    expect((await ui.find({ type: 'Text', text: /cost/ }))?.text).toContain('$1.23')
    expect(await ui.find({ type: 'Text', text: /Fable weekly/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeUndefined()
    await ui.press({ key: 'agents' })
    expect((await ui.find({ type: 'Text', text: /Explore/ }))?.text).toContain('32%')
    expect((await ui.find({ type: 'Text', text: /general-pu/ }))?.text).toContain('1m4s')
    // The toggle is session state: fold it back so the next surface starts collapsed.
    await ui.press({ key: 'agents' })
    expect(await ui.find({ type: 'Text', text: /idle/ })).toBeDefined()
    await ui.unmount()
  }
})

test('with no reading the pane says so', async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

test('a window burning faster than its reset is a warning', async $ => {
  const all = parseHours('00:00', '00:00', true)
  const now = 3_600_000
  const h = { session: [{ t: 0, p: 40 }, { t: now, p: 70 }], weekly_all: [{ t: 0, p: 10 }, { t: now, p: 11 }] }
  const limits = [
    { kind: 'session', label: '5-hour', percent: 70, resetsAt: new Date(now + 2 * 3_600_000).toISOString() },
    { kind: 'weekly_all', label: 'weekly', percent: 11, resetsAt: new Date(now + 2 * 86_400_000).toISOString() },
  ]
  const w = project(limits, h, now, all)
  expect(w.session).toBe(now + 3_600_000)
  expect(w.weekly_all).toBeUndefined()
})

test('projection counts work hours only', async $ => {
  // 5 Jan 2026 is a Monday; the 9th a Friday.
  const h = parseHours('08:00', '17:30', false)
  const at = (hh: number, mm = 0, day = 5) => new Date(2026, 0, day, hh, mm).getTime()
  expect(workingMs(at(7), at(9), h)).toBe(3_600_000)
  expect(workingMs(at(17), at(9, 0, 6), h)).toBe(90 * 60_000)
  expect(afterWorking(at(17), 3_600_000, h)).toBe(at(8, 30, 6))
  // 30%/working-hour from 70% at 17:00 runs out at 08:30 tomorrow: after a 02:00 reset, so no warning.
  const history = { session: [{ t: at(16), p: 40 }, { t: at(17), p: 70 }] }
  const limit = { kind: 'session', label: '5-hour', percent: 70 }
  expect(project([{ ...limit, resetsAt: new Date(at(2, 0, 6)).toISOString() }], history, at(17), h).session).toBeUndefined()
  expect(project([{ ...limit, resetsAt: new Date(at(12, 0, 6)).toISOString() }], history, at(17), h).session).toBe(at(8, 30, 6))
  expect(parseHours('junk', '17:30', false)).toEqual({ start: 0, end: 1440, weekends: false })
  // Friday 17:00 plus one working hour lands Monday 08:30; with weekends on, Saturday.
  expect(afterWorking(at(17, 0, 9), 3_600_000, h)).toBe(at(8, 30, 12))
  expect(afterWorking(at(17, 0, 9), 3_600_000, { ...h, weekends: true })).toBe(at(8, 30, 10))
  expect(workingMs(at(17, 0, 9), at(9, 0, 12), h)).toBe(90 * 60_000)
})

test('wall-clock projection counts every hour', async $ => {
  // With wallClock on, the work day setting no longer matters.
  const all = { start: 0, end: 1440, weekends: true }
  expect(parseHours('08:00', '17:30', false, true)).toEqual(all)
  expect(parseHours('junk', 'junk', false, true)).toEqual(all)
  // 5 Jan 2026 is a Monday. The same history as the work-hours case: 30% in the hour to 17:00.
  const work = parseHours('08:00', '17:30', false)
  const wall = parseHours('08:00', '17:30', false, true)
  const at = (hh: number, mm = 0, day = 5) => new Date(2026, 0, day, hh, mm).getTime()
  const history = { session: [{ t: at(16), p: 40 }, { t: at(17), p: 70 }] }
  const limits = [{ kind: 'session', label: '5-hour', percent: 70, resetsAt: new Date(at(2, 0, 6)).toISOString() }]
  expect(project(limits, history, at(17), work).session).toBeUndefined()
  // 30%/hour of wall-clock time from 70% leaves (100 - 70) / 30 = 1 hour: 18:00, before the 02:00 reset.
  expect(project(limits, history, at(17), wall).session).toBe(at(17) + 3_600_000)
})

test('a dial of any width fills exactly its grid', async () => {
  for (const w of [21, 17]) {
    const bytes = Uint8Array.from(atob(dialCells(50, true, w)), c => c.charCodeAt(0))
    expect(bytes.length).toBe(w * dialRows(w) * 3 * 4)
  }
  expect(dialRows(21)).toBe(6)
  expect(dialRows(17)).toBe(5)
  const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length
  expect(size(sweepCells(95, true))).toBe(SW * SR * 12)
  expect(size(tachCells(40))).toBe(SW * SR * 12)
  expect(size(barCells(undefined))).toBe(FW * FR * 12)
  expect(size(faceCells(MJ, 80, true, Math.PI * 1.25, Math.PI * -0.25, 8, 0.8))).toBe(MJ * (MJ / 2) * 12)
  expect(size(minorCells(50, true))).toBe(MN * (MN / 2) * 12)
})

test('every theme has a README category', () => {
  for (const t of THEMES) expect(['classic', 'vehicles', 'beyond']).toContain(categoryOf(t))
  expect(categoryOf('minimal')).toBe('classic')
  expect(categoryOf('eighties-digital-dash')).toBe('vehicles')
})

test('each theme orders the three windows its own way', () => {
  const all = [{ kind: 'session', label: '5-hour', percent: 1 }, { kind: 'weekly_all', label: 'weekly', percent: 2 }, { kind: 'weekly_scoped', label: 'Fable weekly', percent: 3 }]
  expect(dials(all, 'eighties-digital-dash').map(d => d.label)).toEqual(['5-hour', 'weekly', 'Fable weekly'])
  expect(dials(all, 'silver-bezel').map(d => d.label)).toEqual(['5-hour', 'weekly', 'Fable weekly'])
  expect(dials(all, 'classic').map(d => d.w)).toEqual([21, 21, 21])
  for (const t of THEMES) expect(dials(all, t)).toHaveLength(3)
})

test('the silver-bezel theme draws the pane too', { options: { theme: 'silver-bezel' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

// The usage endpoint, seen from beneath the plugin: what it asks, and what it
// does when the answer fails or never comes.
const HANDLE = 'handle-that-must-not-leak'
const MEASURE = { context: { window: 200000 }, rateLimits: [], changed: ['context'] } as const
const endpoint = (on: Parameters<Parameters<typeof test>[1]>[1], answer: (n: number) => unknown) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const stored: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  const authorized: unknown[] = []
  on('session.authorize', (_, e) => { authorized.push(e); return { value: { handle: HANDLE, kind: 'bearer' } } })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const calls: { url: string; init?: unknown }[] = []
  const shown: string[] = []
  on('http.fetch', (_, e) => { calls.push(e); return answer(calls.length) as never })
  on('ui.toast', (_, e) => { shown.push(JSON.stringify(e)); return { value: undefined } })
  on('ui.status', (_, e) => { shown.push(JSON.stringify(e)); return { value: undefined } })
  return { clock, calls, shown, stored, authorized }
}
const ON = { options: { usageEndpoint: true } }

test('the usage endpoint is asked by handle, once a minute, and its answer kept', ON, async ($, on) => {
  const body = { limits: [{ kind: 'session', percent: 61.54, resets_at: '2027-01-01T00:00:00Z' }, { kind: 'weekly_scoped', percent: 12, scope: { model: { display_name: 'Fable' } } }], account: 'not kept' }
  const { clock, calls, stored } = endpoint(on, () => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }))
  await $.session.measure(MEASURE)
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toBe('https://api.anthropic.com/api/oauth/usage')
  // The plugin hands over the opaque handle; the engine sets the header itself.
  expect(calls[0]?.init).toEqual({ auth: HANDLE, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
  // Only kind and percent reach the store.
  expect(stored.history).toEqual({ session: [{ t: clock.now(), p: 61.5 }], weekly_scoped: [{ t: clock.now(), p: 12 }] })
  await $.session.measure(MEASURE)
  expect(calls).toHaveLength(1)
  await clock.advance(61_000)
  await $.session.measure(MEASURE)
  expect(calls).toHaveLength(2)
})

test('a failed call surfaces nothing and is not retried within the minute', ON, async ($, on) => {
  const { clock, calls, shown, stored } = endpoint(on, () => { throw new Error(`refused: Authorization: Bearer ${HANDLE}`) })
  await $.session.measure(MEASURE)
  await $.session.measure(MEASURE)
  expect(calls).toHaveLength(1)
  expect(shown.join('')).not.toContain(HANDLE)
  expect(JSON.stringify(stored)).not.toContain(HANDLE)
  await clock.advance(61_000)
  await $.session.measure(MEASURE)
  expect(calls).toHaveLength(2)
  expect(shown.join('')).not.toContain(HANDLE)
})

test('a call that never answers gives up and lets the session go on', ON, async ($, on) => {
  const { clock, calls } = endpoint(on, () => new Promise(() => {}))
  let done = false
  const measured = $.session.measure(MEASURE).then(() => { done = true })
  await clock.settle()
  expect(calls).toHaveLength(1)
  expect(done).toBe(false)
  await clock.advance(5_000)
  await measured
  expect(done).toBe(true)
})

test('by default the usage endpoint is never asked, and burn rate still records', async ($, on) => {
  const { clock, calls, stored, authorized } = endpoint(on, () => { throw new Error('must not be called') })
  const at = '2027-01-01T00:00:00Z'
  const measure = (five: number) => ({ ...MEASURE, rateLimits: [{ kind: 'five_hour', percentUsed: five, resetsAt: at }, { kind: 'seven_day', percentUsed: 12, resetsAt: at }] }) as never
  await $.session.measure(measure(40))
  expect(stored.history).toEqual({ session: [{ t: clock.now(), p: 40 }], weekly_all: [{ t: clock.now(), p: 12 }] })
  // Within the minute the gauges follow the engine, but the history takes no new sample.
  await $.session.measure(measure(41))
  expect((stored.history as Record<string, unknown[]>).session).toHaveLength(1)
  await clock.advance(61_000)
  await $.session.measure(measure(45))
  expect((stored.history as Record<string, unknown[]>).session).toEqual([{ t: clock.now() - 61_000, p: 40 }, { t: clock.now(), p: 45 }])
  expect(authorized).toHaveLength(0)
  expect(calls).toHaveLength(0)
})

test('with the endpoint on but failing, the engine windows stay live and burn rate records', ON, async ($, on) => {
  const { clock, stored } = endpoint(on, () => { throw new Error('no sign-in') })
  const at = '2027-01-01T00:00:00Z'
  const measure = (five: number) => ({ ...MEASURE, rateLimits: [{ kind: 'five_hour', percentUsed: five, resetsAt: at }, { kind: 'seven_day', percentUsed: 12, resetsAt: at }] }) as never
  await $.session.measure(measure(40))
  await clock.advance(61_000)
  await $.session.measure(measure(45))
  expect((stored.history as Record<string, { p: number }[]>).session.map(s => s.p)).toEqual([40, 45])
})

test('auto slots follow the plan: no 5-hour window moves weekly to the main gauge and context to the second', () => {
  const week = { kind: 'weekly_all', label: 'weekly', percent: 30 }
  const five = { kind: 'session', label: '5-hour', percent: 60 }
  const scoped = { kind: 'weekly_scoped', label: 'Fable weekly', percent: 10 }
  expect(sources(['auto', 'auto', 'auto'], [five, week, scoped])).toEqual(['five-hour', 'weekly', 'model-weekly'])
  expect(sources(['auto', 'auto', 'auto'], [week, scoped])).toEqual(['weekly', 'context', 'model-weekly'])
  // Before any reading, auto keeps the usual order.
  expect(sources(['auto', 'auto', 'auto'], [])).toEqual(['five-hour', 'weekly', 'model-weekly'])
  // A set slot wins over auto.
  expect(sources(['context', 'auto', 'five-hour'], [week])).toEqual(['context', 'context', 'five-hour'])
  const d = dials([week, scoped], 'classic', ['auto', 'auto', 'auto'], 42)
  expect(d.map(x => [x.source, x.label, x.limit?.percent])).toEqual([['weekly', 'weekly', 30], ['context', 'context', 42], ['model-weekly', 'Fable weekly', 10]])
  expect(dials([week], 'classic', ['auto', 'auto', 'auto'])[1]?.limit).toBeUndefined()
  expect(slotOf('weekly')).toBe('weekly')
  expect(slotOf('nonsense')).toBe('auto')
  expect(slotOf(undefined)).toBe('auto')
})

// A plan with no 5-hour window: auto puts weekly on the main gauge and
// context fill on the second. `warn` seeds the burn-rate warnings.
const noFive = (on: Parameters<Parameters<typeof test>[1]>[1], warn: Record<string, number> = {}) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const at = new Date(3 * 86_400_000).toISOString()
  const seeded: Record<string, unknown> = {
    warnings: { shape: 'warnings-1', value: warn },
    limits: { shape: 'limits-1', value: [{ kind: 'weekly_all', label: 'weekly', percent: 30, resetsAt: at }, { kind: 'weekly_scoped', label: 'Fable weekly', percent: 10, resetsAt: at }] },
    usage: { shape: 'usage-1', value: { percent: 42, tokens: 84000, window: 200000, rateLimits: [], usd: 1.23 } },
  }
  on('state.get', async (_, e, next) => {
    const own = await next(e)
    if (!('value' in own) || !own.value || own.value.value !== undefined) return own
    return e.key in seeded ? { value: { value: seeded[e.key], version: 0 } } : own
  })
}

const clean = async (ui: { find: (q: { type: 'Text'; text: RegExp }) => Promise<unknown> }) => {
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeUndefined()
}

test('classic on a plan with no 5-hour window: weekly on the main gauge, context on the second', async ($, on) => {
  noFive(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /^\s*weekly\s*$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^\s*context\s*$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^\s*42%\s*$/ })).toBeDefined()
    } else {
      expect((await ui.find({ type: 'Text', text: /^weekly/ }))?.text).toContain('30%')
      expect((await ui.find({ type: 'Text', text: /^context/ }))?.text).toContain('42%')
    }
    expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeUndefined()
    await clean(ui)
    await ui.unmount()
  }
})

test('eighties-digital-dash follows the slots: weekly sweep, context in the fuel column', { options: { theme: 'eighties-digital-dash' } }, async ($, on) => {
  noFive(on, { weekly_all: 3_600_000 })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^30%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^CONTEXT 42%$/ })).toBeDefined()
  // The warned weekly dial prints its own empty-in time; context is never warned.
  expect(await ui.find({ type: 'Text', text: /! empty in 1h/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /RESERVE/ })).toBeUndefined()
  await clean(ui)
  await ui.unmount()
})

test('eighties-digital-dash keeps the second gauge label beside RESERVE', { options: { theme: 'eighties-digital-dash', gauge2: 'model-weekly' } }, async ($, on) => {
  noFive(on, { weekly_scoped: 3_600_000 })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^FABLE WEEKLY 10%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /RESERVE ! empty in 1h/ })).toBeDefined()
  await clean(ui)
  await ui.unmount()
})

test('silver-bezel follows the slots: the fuel gauge reads what is left of the second', { options: { theme: 'silver-bezel' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^weekly$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^30%$/ })).toBeDefined()
  // Context has no reset, so its caption ends at the percent.
  expect(await ui.find({ type: 'Text', text: /^context 42%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^LEFT 58%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /WK LEFT/ })).toBeUndefined()
  await clean(ui)
  await ui.unmount()
})

test('silver-bezel with no reading on the second gauge shows ––%', { options: { theme: 'silver-bezel', gauge2: 'five-hour' } }, async ($, on) => {
  noFive(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^LEFT ––%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^5-hour ––% no reading$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /undefined|NaN/ })).toBeUndefined()
  await ui.unmount()
})

test('the band warns for every window on course to run out, on a dial or not', { options: { gauge1: 'context', gauge2: 'weekly', gauge3: 'context' } }, async ($, on) => {
  noFive(on, { weekly_all: 3_600_000, weekly_scoped: 7_200_000 })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ type: 'Text', text: /ctx/ }))?.text).toContain('42%')
  expect(await band.find({ type: 'Text', text: /! weekly/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /! Fable weekly/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /5-hour|context|undefined|NaN/ })).toBeUndefined()
  await band.unmount()
})

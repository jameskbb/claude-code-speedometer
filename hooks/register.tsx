import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register } from 'claude-code'

type EngineOf = EngineInterface

import type { SpeedoAgent, SpeedoLimit, SpeedoMode, SpeedoTurn, SpeedoUsage } from '../types'

import { EXTRA } from './themes'
import { arc, bar, clamp, dialCells, dialRows, DW, encode, line, pct, PX, reading, seconds, SOURCES, until, zone } from './themes/kit'
import type { Category, Dial, Gauge, Source, ThemeCtx } from './themes/kit'

// Re-exported for the tests, which import the pixel math from here.
export { dialCells, dialRows, DW }

const PANE = 'speedometer'
const TITLE = 'Speedometer'

const usage = atom({ plugin: 'speedometer', key: 'usage' } as const, null as SpeedoUsage | null, { shape: 'usage-1' })
// The account's windows as the usage endpoint lists them; null until fetched.
const limits = atom({ plugin: 'speedometer', key: 'limits' } as const, null as SpeedoLimit[] | null, { shape: 'limits-1' })
// The session's subagents, newest last; the last 12 are kept.
const agents = atom({ plugin: 'speedometer', key: 'agents' } as const, [] as SpeedoAgent[], { shape: 'agents-1' })
// The ponytail plugin's live level for this project (`lite`, `full`, `ultra`), null when off.
const ponytail = atom({ plugin: 'speedometer', key: 'ponytail' } as const, null as string | null)
// Per window kind, when the burn rate says it hits 100% (ms), only where that is before its reset.
const warnings = atom({ plugin: 'speedometer', key: 'warnings' } as const, {} as Record<string, number>, { shape: 'warnings-1' })
const agentsOpen = atom({ plugin: 'speedometer', key: 'agentsOpen' } as const, false)
const turn = atom({ plugin: 'speedometer', key: 'turn' } as const, { count: 0, lastMs: 0, tools: 0 } as SpeedoTurn, { shape: 'turn-1' })
const mode = atom({ plugin: 'speedometer', key: 'mode' } as const, 'idle' as SpeedoMode)
// The highest warning threshold already toasted; reset on compaction.
const warned = atom({ plugin: 'speedometer', key: 'warned' } as const, 0)

const THRESHOLDS = [80, 90]
const BADGE: Record<SpeedoMode, { glyph: string; label: string; color: Color }> = {
  idle: { glyph: '○', label: 'idle', color: 'inactive' },
  working: { glyph: '◐', label: 'thinking', color: 'claude' },
  tool: { glyph: '⚙', label: 'tool running', color: 'permission' },
}

// The eighties-digital-dash cluster, after a late-1980s LCD dash: on a black panel, a lit
// sweep rising left to right that widens toward the top for the main and
// third gauges, a fuel-style bar with F, half and E marks for the second,
// amber ticks and digits. The unlit scale shows its zones dimly, green then
// amber then red at the top, like a redline.
const LCD = {
  bg: 0x0a0a0a, green: 0x9ee8a8, amber: 0xffb000, red: 0xff3b3b, dimGreen: 0x16321c, dimAmber: 0x4a3200, dimRed: 0x4c1212,
  digit: '#ffa500', panel: '#0a0a0a',
}
const lcdPx = (frac: number, lit: boolean) =>
  frac >= 0.9 ? (lit ? LCD.red : LCD.dimRed) : frac >= 0.75 ? (lit ? LCD.amber : LCD.dimAmber) : lit ? LCD.green : LCD.dimGreen
export const SW = 23
export const SR = 10
export const FW = 6
export const FR = 7

// One LCD band on an ellipse centred (cx, cy) with radii rx, ry, swept from
// angle a0 to a1 (radians, 0 is right, π is left); it widens toward the top
// of its scale as the real bands do, with amber ticks outside every tenth.
function lcdBand(pw: number, ph: number, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, fill: number): Uint32Array {
  const px = new Uint32Array(pw * ph).fill(LCD.bg)
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const nx = (x - cx) / rx
      const ny = (cy - y) / ry
      const r = Math.hypot(nx, ny)
      const frac = (Math.atan2(ny, nx) - a0) / (a1 - a0)
      if (frac < 0 || frac > 1) continue
      const inner = 1 - 0.12 - 0.22 * frac
      if (r >= inner && r <= 1) px[y * pw + x] = lcdPx(frac, frac <= fill)
      else if (r > 1.06 && r <= 1.16 && Math.abs(frac * 10 - Math.round(frac * 10)) < 0.2) px[y * pw + x] = LCD.amber
    }
  }
  return px
}

function lcdWarn(px: Uint32Array, pw: number, ph: number) {
  for (let y = ph - 2; y < ph; y += 1) for (let x = 0; x < 3; x += 1) px[y * pw + x] = LCD.red
}

// The speedometer: a band rising from the lower left and bending right.
export function sweepCells(percent: number | undefined, warn = false): string {
  const pw = SW
  const ph = SR * 2
  const px = lcdBand(pw, ph, pw + 2, ph + 1, pw - 1, ph - 2, Math.PI * 0.97, Math.PI * 0.58, clamp(percent))
  if (warn) lcdWarn(px, pw, ph)
  return encode(px, pw, ph)
}

// The tachometer: a band climbing from the lower left and arching over the top.
export function tachCells(percent: number | undefined, warn = false): string {
  const pw = SW
  const ph = SR * 2
  const px = lcdBand(pw, ph, 11, ph - 1, 10.5, ph - 3, Math.PI, Math.PI * 0.22, clamp(percent))
  if (warn) lcdWarn(px, pw, ph)
  return encode(px, pw, ph)
}

// The fuel gauge: a column filling upward, F, ½ and E ticks on its right.
export function barCells(percent: number | undefined, warn = false): string {
  const pw = FW
  const ph = FR * 2
  const px = new Uint32Array(pw * ph).fill(LCD.bg)
  const fill = clamp(percent)
  for (let y = 0; y < ph; y += 1) {
    const frac = (ph - y) / ph
    for (let x = 0; x < pw - 2; x += 1) px[y * pw + x] = lcdPx(frac, frac <= fill)
  }
  for (const y of [0, ph / 2, ph - 1]) px[y * pw + pw - 1] = LCD.amber
  if (warn) for (let y = ph - 2; y < ph; y += 1) for (let x = 0; x < pw - 2; x += 1) px[y * pw + x] = LCD.red
  return encode(px, pw, ph)
}

// The silver-bezel cluster, after an early-2000s muscle car: white-faced
// round gauges in silver bezels, black ticks, a red redline arc and red
// needle; a big tachometer and speedometer either side of four small
// 90-degree gauges. No badge: the centre stays no taller than the big gauges.
const SN = { face: 0xe9e9e4, bezel: 0x8c8c8c, tick: 0x111111, red: 0xd0202a, hub: 0x202020, check: 0xffb000, panel: '#101010', silver: '#c8c8c8' }
export const MJ = 20
export const MN = 10

// A round face w pixels across (w even), its needle swept clockwise from
// angle a0 to a1 (radians, 0 is right), `ticks` marks, red from `redFrom`.
export function faceCells(w: number, percent: number | undefined, warn: boolean, a0: number, a1: number, ticks: number, redFrom: number): string {
  const pw = w
  const ph = w
  const cx = (pw - 1) / 2
  const cy = (ph - 1) / 2
  const R = pw / 2 - 0.1
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fracAt = (dx: number, dy: number) => {
    let ang = a0 - Math.atan2(dy, dx)
    while (ang < 0) ang += 2 * Math.PI
    while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
    return ang / (a0 - a1)
  }
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      if (r > R - 1) { px[y * pw + x] = SN.bezel; continue }
      px[y * pw + x] = SN.face
      const frac = fracAt(dx, dy)
      if (frac > 1.0001) continue
      const red = frac >= redFrom
      if (red && r > R - 2 && r <= R - 1) px[y * pw + x] = SN.red
      const near = Math.abs(frac * ticks - Math.round(frac * ticks)) * (R * (a0 - a1)) / ticks < 0.6
      if (near && r > R - (w >= MJ ? 3.2 : 2.4) && r <= R - 1) px[y * pw + x] = red ? SN.red : SN.tick
    }
  }
  const fill = clamp(percent)
  if (fill >= 0) {
    const t = a0 - fill * (a0 - a1)
    for (let r = 0; r < R - 2; r += 0.4) {
      const x = Math.round(cx + r * Math.cos(t))
      const y = Math.round(cy - r * Math.sin(t))
      px[y * pw + x] = SN.red
    }
  }
  for (const [x, y] of [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]) px[y! * pw + x!] = SN.hub
  if (warn) {
    const y = Math.round(cy + R / 2)
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) { px[y * pw + x] = SN.check; px[(y + 1) * pw + x] = SN.check }
  }
  return encode(px, pw, ph)
}

const major: Gauge = { w: MJ, rows: MJ / 2, cells: (p, warn) => faceCells(MJ, p, warn, Math.PI * 1.25, Math.PI * -0.25, 8, 0.8) }
// The small gauges sweep 90 degrees across their top.
export const minorCells = (p: number | undefined, warn = false) => faceCells(MN, p, warn, Math.PI * 0.75, Math.PI * 0.25, 2, 0.85)

// The built-in clusters, then each theme file's under hooks/themes/.
// `minimal` draws no gauges: only the session's facts (context, cost, model, turns, agents).
export const THEMES: readonly string[] = ['eighties-digital-dash', 'silver-bezel', 'classic', 'minimal', ...EXTRA.map(t => t.id)]
export type Theme = string
// Old theme ids, renamed to generic ones, so a /config value saved under one
// still picks the same cluster. Each points straight at a current id, never at
// another alias: the 0.5.x brand names first, then the 0.6.0 names renamed again.
export const THEME_ALIASES: Readonly<Record<string, Theme>> = {
  'corvette-c4': 'eighties-digital-dash',
  'mustang-terminator': 'silver-bezel',
  'lamborghini-huracan': 'hex-supercar',
  'porsche-911': 'five-dial-sports',
  'ferrari-f40': 'spartan-supercar',
  'tron-lightcycle': 'neon-grid',
  'f1-wheel': 'race-wheel',
  'skyline-r34': 'boost-screen',
  'knight-rider': 'scanner-dash',
  'bel-air-1957': 'fifties-chrome',
  delorean: 'chrono-console',
  'wrx-gc8': 'nineties-rally',
  'white-face-muscle': 'silver-bezel',
  'hexagon-tft': 'hex-supercar',
  'tuner-mfd': 'boost-screen',
}
// The theme a /config value picks: a current id, an old id's new one, else classic.
export function resolveTheme(value: unknown): Theme {
  const id = typeof value === 'string' ? (THEME_ALIASES[value] ?? value) : undefined
  return THEMES.find(t => t === id) ?? 'classic'
}
// The engine drops a stored value that is not among the field's `options`, so
// an old id reaches register as unset. This reads the saved value itself and
// answers its new id, or undefined when no old id is saved.
export async function savedAlias($: EngineOf): Promise<Theme | undefined> {
  const configs = (await $.settings.read({ key: 'pluginConfigs' })) as Record<string, { options?: Record<string, unknown> }> | undefined
  for (const [plugin, config] of Object.entries(configs ?? {})) {
    if (plugin !== 'speedometer' && !plugin.startsWith('speedometer@')) continue
    const saved = config?.options?.theme
    if (typeof saved === 'string' && THEME_ALIASES[saved]) return THEME_ALIASES[saved]
  }
  return undefined
}
// At session start: a theme saved under an old id is saved again under its new
// one, so /config shows it, and the new id is answered for this load to draw.
async function adoptRenamedTheme($: EngineOf): Promise<Theme | undefined> {
  const renamed = await savedAlias($).catch(() => undefined)
  if (renamed) await $.config.set({ key: 'speedometer.theme', value: renamed }).catch(() => undefined)
  return renamed
}
// The README category of each theme (Plain is 'classic'): the built-ins here,
// every other theme from its ThemeDef.
const BUILTIN_CATEGORY: Record<string, Category> = { 'eighties-digital-dash': 'vehicles', 'silver-bezel': 'vehicles', classic: 'classic', minimal: 'classic' }
export function categoryOf(id: Theme): Category {
  const c = BUILTIN_CATEGORY[id] ?? EXTRA.find(t => t.id === id)?.category
  if (!c) throw new Error(`no category for theme ${id}`)
  return c
}
const sweep: Gauge = { w: SW, rows: SR, cells: sweepCells }
const fuel: Gauge = { w: FW, rows: FR, cells: barCells }
const tach: Gauge = { w: SW, rows: SR, cells: tachCells }

// A slot's /config value: one source, or `auto`.
export type Slot = Source | 'auto'
export const slotOf = (v: unknown): Slot => (typeof v === 'string' && (SOURCES as readonly string[]).includes(v) ? (v as Source) : 'auto')

// What each slot shows. `auto` follows the plan: 5-hour, weekly, model weekly;
// on a plan that reports a weekly window but has never reported a 5-hour one
// this session, weekly moves to the main gauge and week pace (how far through
// the weekly window the clock is) takes the second. `sawFive` makes that choice stick, so a reading that happens to lack
// the 5-hour window never reshuffles the gauges. A `planless` session (one that
// has had a reply measured and never reported any window, as with an API key)
// puts context fill on the main gauge. Auto slots skip any source a set slot
// already shows.
export function sources(slots: readonly [Slot, Slot, Slot], all: SpeedoLimit[], sawFive = false, planless = false): [Source, Source, Source] {
  const noFive = !sawFive && !all.some(r => r.kind === 'session') && all.some(r => r.kind === 'weekly_all')
  const order: Source[] = planless && all.length === 0 ? ['context', 'five-hour', 'weekly', 'model-weekly', 'week-pace']
    : noFive ? ['weekly', 'week-pace', 'model-weekly', 'context', 'five-hour'] : ['five-hour', 'weekly', 'model-weekly', 'context', 'week-pace']
  const free = order.filter(o => !slots.includes(o))
  return slots.map(s => (s === 'auto' ? (free.shift() ?? 'context') : s)) as [Source, Source, Source]
}

// One slot's dial, without its gauge shape: the source's label and reading.
const WEEK_MS = 7 * 86_400_000
export function bind(source: Source, all: SpeedoLimit[], context?: number, now = Date.now()): Omit<Dial, keyof Gauge> {
  if (source === 'week-pace') {
    // How much of the weekly window has passed, to read against weekly used.
    const reset = all.find(r => r.kind === 'weekly_all')?.resetsAt
    const left = reset ? Date.parse(reset) - now : NaN
    return { source, label: 'week pace', limit: Number.isFinite(left) ? { kind: 'week_pace', label: 'week pace', percent: Math.round(Math.max(0, Math.min(1, 1 - left / WEEK_MS)) * 100), resetsAt: reset } : undefined }
  }
  if (source === 'context') return { source, label: 'context', limit: context === undefined ? undefined : { kind: 'context', label: 'context', percent: context } }
  if (source === 'model-weekly') {
    const scoped = all.find(r => r.kind === 'weekly_scoped')
    return { source, label: scoped?.label ?? 'model weekly', limit: scoped }
  }
  return source === 'five-hour' ? { source, label: '5-hour', limit: all.find(r => r.kind === 'session') } : { source, label: 'weekly', limit: all.find(r => r.kind === 'weekly_all') }
}

// The three dials, in slot order, shaped by the theme.
export function dials(all: SpeedoLimit[], theme: Theme, slots: readonly [Slot, Slot, Slot] = ['auto', 'auto', 'auto'], context?: number, sawFive = false, planless = false, now = Date.now()): Dial[] {
  const [main, second, third] = sources(slots, all, sawFive, planless).map(s => bind(s, all, context, now)) as [Omit<Dial, keyof Gauge>, Omit<Dial, keyof Gauge>, Omit<Dial, keyof Gauge>]
  const extra = EXTRA.find(t => t.id === theme)
  if (extra) return extra.gauges(main, second, third)
  return theme === 'eighties-digital-dash' ? [{ ...main, ...sweep }, { ...second, ...fuel }, { ...third, ...tach }]
    // The fuel gauge reads what is left, so its needle drops as the slot fills.
    : theme === 'silver-bezel' ? [{ ...main, ...major }, { ...second, w: MN, rows: MN / 2, cells: (p, warn) => minorCells(p === undefined ? undefined : 100 - p, warn) }, { ...third, ...major }]
    : [{ ...main, ...arc(DW) }, { ...second, ...arc(DW) }, { ...third, ...arc(DW) }]
}

// The engine only reports the 5-hour and weekly windows: all the gauges show
// with the usage endpoint off, and the fallback while it has not answered.
const fromEngine = (rl: SpeedoUsage['rateLimits']): SpeedoLimit[] =>
  rl.flatMap(r =>
    r.kind === 'five_hour' ? [{ kind: 'session', label: '5-hour', percent: r.percentUsed, resetsAt: r.resetsAt }]
    : r.kind === 'seven_day' ? [{ kind: 'weekly_all', label: 'weekly', percent: r.percentUsed, resetsAt: r.resetsAt }]
    : [])

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const FETCH_MS = 5_000

type UsageLimitRow = { kind?: unknown; percent?: unknown; resets_at?: unknown; scope?: { model?: { display_name?: unknown } | null } | null }

// Reads the account's windows as /usage does: `limits[]`, the scoped weekly
// one carrying the model it scopes. Null when the host has no first-party
// credential or the call fails; the caller keeps what it had.
async function fetchLimits($: EngineOf): Promise<SpeedoLimit[] | null> {
  const auth = (await $.session.authorize())?.handle
  if (!auth) return null
  // The host's fetch takes no timeout, so a stalled request gives up after
  // FETCH_MS rather than holding the session's hooks; the wait is cancelled
  // as soon as the answer comes.
  const stop = new AbortController()
  const late = $.clock.sleep(FETCH_MS, { signal: stop.signal }).then(() => null, () => null)
  const r = await Promise.race([$.http.fetch(USAGE_URL, { auth, headers: { 'anthropic-beta': 'oauth-2025-04-20' } }), late])
  stop.abort()
  if (!r?.ok) return null
  const rows = (JSON.parse(r.text) as { limits?: UsageLimitRow[] }).limits
  if (!Array.isArray(rows)) return null
  return rows.flatMap(row => {
    if (typeof row.kind !== 'string' || typeof row.percent !== 'number') return []
    const model = row.scope?.model?.display_name
    const label = row.kind === 'session' ? '5-hour' : row.kind === 'weekly_all' ? 'weekly' : typeof model === 'string' ? `${model} weekly` : row.kind.replace(/_/g, ' ')
    return [{ kind: row.kind, label, percent: Math.round(row.percent * 10) / 10, resetsAt: typeof row.resets_at === 'string' ? row.resets_at : undefined }]
  })
}

const pick = (u: { context: { percent?: number; tokens?: number; window: number }; rateLimits: SpeedoUsage['rateLimits']; cost?: { usd: number } }): SpeedoUsage => ({
  percent: u.context.percent,
  tokens: u.context.tokens,
  window: u.context.window,
  rateLimits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
  usd: u.cost?.usd,
})

let fetchedAt = 0
let toasted = new Set<string>()

type Sample = { t: number; p: number }
const HISTORY = 'history'
const DAY = 86_400_000

// How far back the burn rate looks, in working time: an hour for the 5-hour window, six for a weekly one.
const lookback = (kind: string) => (kind === 'session' ? 3_600_000 : 6 * 3_600_000)

// The work day as minutes of the local day (start equal to end means all 24
// hours), and whether Saturday and Sunday count. With every set (the default
// wall-clock mode) it is all 24 hours of all seven days, whatever the others say.
export type Hours = { start: number; end: number; weekends: boolean }

export function parseHours(start: string, end: string, weekends: boolean, every = false): Hours {
  if (every) return { start: 0, end: 1440, weekends: true }
  const mins = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
    return m ? Math.min(1440, Number(m[1]) * 60 + Number(m[2])) : NaN
  }
  const a = mins(start)
  const b = mins(end)
  return Number.isNaN(a) || Number.isNaN(b) || a >= b ? { start: 0, end: 1440, weekends } : { start: a, end: b, weekends }
}

const dayStart = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime()
const MIN = 60_000
const nextDay = (day: number) => dayStart(day + DAY + DAY / 2)
const isOff = (day: number, h: Hours) => !h.weekends && [0, 6].includes(new Date(day).getDay())

// Working milliseconds between a and b.
export function workingMs(a: number, b: number, h: Hours): number {
  let sum = 0
  for (let day = dayStart(a); day <= b && day < a + 400 * DAY; day = nextDay(day)) {
    if (isOff(day, h)) continue
    sum += Math.max(0, Math.min(b, day + h.end * MIN) - Math.max(a, day + h.start * MIN))
  }
  return sum
}

// The wall-clock time by which `ms` of working time has passed from `from`.
export function afterWorking(from: number, ms: number, h: Hours): number {
  let left = ms
  for (let day = dayStart(from); day < from + 400 * DAY; day = nextDay(day)) {
    if (isOff(day, h)) continue
    const open = Math.max(from, day + h.start * MIN)
    const room = day + h.end * MIN - open
    if (room <= 0) continue
    if (left <= room) return open + left
    left -= room
  }
  return Number.POSITIVE_INFINITY
}

// Projects each window from its slope over working time; a window whose slope
// reaches 100% before its reset is a warning, keyed by kind to the time it runs out.
export function project(all: SpeedoLimit[], history: Record<string, Sample[]>, now: number, h: Hours): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of all) {
    if (!l.resetsAt) continue
    const resetsAt = Date.parse(l.resetsAt)
    let samples = (history[l.kind] ?? []).filter(s => workingMs(s.t, now, h) <= lookback(l.kind))
    // A drop is a reset: only what came after it describes this window.
    for (let i = samples.length - 1; i > 0; i -= 1) if ((samples[i]?.p ?? 0) < (samples[i - 1]?.p ?? 0)) { samples = samples.slice(i); break }
    const first = samples[0]
    const last = samples[samples.length - 1]
    if (!first || !last) continue
    const span = workingMs(first.t, last.t, h)
    if (span < 10 * MIN) continue
    const rate = (last.p - first.p) / span
    if (rate <= 0) continue
    const emptyAt = afterWorking(now, (100 - l.percent) / rate, h)
    if (emptyAt < resetsAt) out[l.kind] = emptyAt
  }
  return out
}

async function remember($: EngineOf, all: SpeedoLimit[], now: number, h: Hours) {
  const had = ((await $.store.get(HISTORY)) ?? {}) as Record<string, Sample[]>
  for (const l of all) had[l.kind] = [...(had[l.kind] ?? []).filter(s => now - s.t <= DAY), { t: now, p: l.percent }].slice(-300)
  await $.store.set(HISTORY, had)
  const warn = project(all, had, now, h)
  await update($, warnings, () => warn)
  for (const [kind, at] of Object.entries(warn)) {
    if (toasted.has(kind)) continue
    toasted.add(kind)
    $.ui.toast(`${all.find(l => l.kind === kind)?.label ?? kind} runs out in ${until(new Date(at).toISOString(), now)}, before its reset`)
  }
  toasted = new Set([...toasted].filter(k => k in warn))
}

// Ponytail keeps its live mode per project at ~/.claude/ponytail-modes/<sha256 of the
// project root>, plus a shared ~/.claude/.ponytail-active; no file means off.
// Read on session start and each turn; written only by cyclePonytail, when the
// person presses the band's ponytail badge.
async function ponytailFlags($: EngineOf): Promise<string[]> {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  if (!home) return []
  const root = await $.session.root()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(root))
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  return [`${home}/.claude/ponytail-modes/${hex}`, `${home}/.claude/.ponytail-active`]
}

async function readPonytail($: EngineOf): Promise<string | null> {
  const [flag] = await ponytailFlags($)
  if (!flag) return null
  const text = await $.fs.read(flag).catch(() => '')
  const level = text.trim().split(/\s+/)[0] ?? ''
  return level && level !== 'off' ? level : null
}

const LEVELS = ['lite', 'full', 'ultra']

// Writes the next level the way ponytail's own /ponytail command does (its
// project flag and the shared one), and tells the model, which already holds
// the level table from its session-start rules.
async function cyclePonytail($: EngineOf, current: string) {
  const next = LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length] ?? 'full'
  for (const flag of await ponytailFlags($)) await $.fs.write(flag, next)
  await update($, ponytail, () => next)
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: `PONYTAIL MODE CHANGED: level ${next}` }] } })
}

// Runs at most once a minute, a failed or refused call included, so an outage
// never turns into a retry on every measurement and the burn-rate history
// takes one sample a minute. With the usage endpoint off (the default) the
// gauges show the engine's own two windows and nothing leaves the session.
// With it on, the endpoint is asked on that cadence and the engine's windows
// stand in until the first answer. A failure is dropped whole: nothing of the
// request or its error is logged or shown.
async function refresh($: EngineOf, rl: SpeedoUsage['rateLimits'], h: Hours, endpoint: boolean) {
  const now = await $.clock.now()
  const due = now - fetchedAt > 60_000
  if (due) fetchedAt = now
  if (!endpoint) {
    const own = fromEngine(rl)
    await update($, limits, () => own)
    if (due && own.length) await remember($, own, now, h)
    return
  }
  const fresh = due ? await fetchLimits($).catch(() => null) : null
  if (fresh) {
    await update($, limits, () => fresh)
    await remember($, fresh, now, h)
    return
  }
  // No new answer: the engine's own windows stay live, and any window only
  // the endpoint reports (the per-model one) keeps its last reading.
  const own = fromEngine(rl)
  const kinds = new Set(own.map(l => l.kind))
  await update($, limits, had => [...own, ...(had ?? []).filter(l => !kinds.has(l.kind))])
  if (due && own.length) await remember($, own, now, h)
}

export const register: Register = (on, options) => {
  let theme = resolveTheme(options.theme)
  const hours = parseHours(String(options.workStart ?? '08:00'), String(options.workEnd ?? '17:00'), options.weekends === true, options.wallClock !== false)
  // Off by default: the usage endpoint is asked only when the person turns this on.
  const usageEndpoint = options.usageEndpoint === true
  const slots = [slotOf(options.gauge1), slotOf(options.gauge2), slotOf(options.gauge3)] as const
  // Set once the plan has reported a 5-hour window, or any window, this
  // session, and once a reply has been measured; see sources().
  let sawFive = false
  let sawAny = false
  let measured = false
  let startedAt = 0
  let tools = 0

  on('session.start', async ($, e, next) => {
    theme = (await adoptRenamedTheme($)) ?? theme
    await $.command.register({ name: 'speedometer', description: 'Open the context speedometer pane' })
    const seed = pick(await $.session.usage())
    await update($, usage, () => seed)
    await refresh($, seed.rateLimits, hours, usageEndpoint)
    const level = await readPonytail($)
    await update($, ponytail, () => level)
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'speedometer' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    return { text: 'Speedometer pane opened.' }
  })

  on('session.measure', async ($, e, next) => {
    measured = true
    const u = pick(e)
    await update($, usage, () => u)
    await refresh($, u.rateLimits, hours, usageEndpoint)
    const p = u.percent
    if (p !== undefined) {
      const crossed = THRESHOLDS.filter(t => p >= t).pop() ?? 0
      if (crossed > (await read($, warned))) {
        await update($, warned, () => crossed)
        $.ui.toast(`Context at ${p}%: compaction is near`)
      }
    }
    return next(e)
  })

  // The three hooks below only watch. Each can refuse what it sits on (a
  // compaction, a tool call, a subagent), so each carries a .catch that fails
  // open: where the hook had called next, its answer is replayed; where it had
  // not, the rest of the chain runs. A fault in the plugin never blocks them.
  on('session.compact', async ($, e, next) => {
    await update($, warned, () => 0)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      startedAt = await $.clock.now()
      tools = 0
      await update($, mode, () => 'working')
      // Ponytail's own UserPromptSubmit hook has run by now.
      const level = await readPonytail($)
      await update($, ponytail, () => level)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, agents, list => list.map(a => (a.id === id ? { ...a, tools: a.tools + 1 } : a)))
      return next(e)
    }
    tools += 1
    await update($, mode, () => 'tool')
    const ran = await next(e)
    await update($, mode, () => 'working')
    return ran
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId !== undefined) {
      const agent: SpeedoAgent = { id: r.agentId, type: e.subagentType, description: e.description, model: r.model, status: 'running', tools: 0, startedAt: await $.clock.now() }
      await update($, agents, list => [...list, agent].slice(-12))
    }
    return r
  }).catch(($, e, next) => next(e))

  // Each model request of a subagent reports its input side: the agent's own
  // context fill.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (e.agentId !== undefined && r.usage) {
      const id = e.agentId
      const tokens = r.usage.input_tokens + r.usage.cache_read_input_tokens + r.usage.cache_creation_input_tokens
      await update($, agents, list => list.map(a => (a.id === id ? { ...a, tokens } : a)))
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      const endedAt = await $.clock.now()
      await update($, agents, list => list.map(a => (a.id === id ? { ...a, status: 'done', endedAt } : a)))
    } else {
      const lastMs = (await $.clock.now()) - startedAt
      await update($, turn, t => ({ count: t.count + 1, lastMs, tools }))
      await update($, mode, () => 'idle')
    }
    return next(e)
  })

  // The band above the prompt: context, activity, cost and turns on one line.
  // The windows' readings live in the pane's dials alone. A burn-rate warning
  // shows here for every window on course to run out, as its toast does,
  // whether or not a slot shows that window: one off the dials still stops the
  // session. Context is never warned; its fill is the ctx bar.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [u, t, m, ag, pt, warn, l] = await Promise.all([read($, usage), read($, turn), read($, mode), read($, agents), read($, ponytail), read($, warnings), read($, limits)])
    if (e.props.hasSurvey || !u) return next(e)
    const running = ag.filter(a => a.status === 'running').length
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = u.percent
    const badge = BADGE[m]
    const tone: Color = p === undefined ? 'inactive' : zone(p)
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text>
          <Text dimColor>ctx </Text>
          <Text color={tone}>{bar(p ?? 0)}</Text>
          <Text color={tone} bold>{` ${pct(p)}`}</Text>
          <Text dimColor>{u.tokens !== undefined ? ` ${Math.round(u.tokens / 1000)}k/${Math.round(u.window / 1000)}k` : ''}</Text>
        </Text>
        <Text color={badge.color}>{badge.glyph} {badge.label}</Text>
        {u.usd !== undefined && <Text dimColor>${u.usd.toFixed(2)}</Text>}
        {t.count > 0 && <Text dimColor>turn {t.count} · {seconds(t.lastMs)} · {t.tools} tool{t.tools === 1 ? '' : 's'}</Text>}
        {running > 0 && <Text color="claude">▶ {running} agent{running === 1 ? '' : 's'}</Text>}
        {pt !== null && (
          <Button key="ponytail" plain onPress={() => cyclePonytail($, pt)}>
            <Text color={pt === 'ultra' ? 'warning' : 'suggestion'} bold>ponytail {pt}</Text>
          </Button>
        )}
        {Object.keys(warn).map(k => <Text color="error" bold>! {(l ?? []).find(x => x.kind === k)?.label ?? k.replace(/_/g, ' ')}</Text>)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [u, l, t, m, ag, pt, warn, open, model, now] = await Promise.all([read($, usage), read($, limits), read($, turn), read($, mode), read($, agents), read($, ponytail), read($, warnings), read($, agentsOpen), $.session.model(), $.clock.now()])
    const p = u?.percent
    // shortcut: a subagent's window is taken as the main model's; upgrade when the API reports a per-agent window.
    const window = u?.window ?? 200_000
    const badge = BADGE[m]
    const centered = (text: string, w: number) => ' '.repeat(Math.max(0, Math.floor((w - text.length) / 2))) + text
    if ((l ?? []).some(r => r.kind === 'session')) sawFive = true
    if (l?.length) sawAny = true
    const all = dials(l ?? [], theme, slots, p, sawFive, measured && !sawAny, now)
    const facts = ({ Box, Text, Button }: Pick<ReturnType<typeof $.ui.resolve>, 'Box' | 'Text' | 'Button'>) => [
      <Text>
        <Text dimColor>{'context  '}</Text>
        <Text color={p === undefined ? 'inactive' : zone(p)}>{bar(p ?? 0)}</Text>
        <Text color={p === undefined ? 'inactive' : zone(p)} bold>{` ${pct(p)}`}</Text>
        <Text dimColor>{u?.tokens !== undefined ? ` ${Math.round(u.tokens / 1000)}k/${Math.round(u.window / 1000)}k` : ''}</Text>
        {'  '}
        <Text color={badge.color} inverse>{` ${badge.glyph} ${badge.label} `}</Text>
      </Text>,
      <Text>
        <Text dimColor>{'cost     '}</Text>
        {u?.usd !== undefined ? `$${u.usd.toFixed(2)}` : '–'}
        <Text dimColor>{'   model  '}</Text>
        {model}
        <Text dimColor>{'   ponytail  '}</Text>
        {pt === null ? <Text dimColor>off</Text> : <Text color={pt === 'ultra' ? 'warning' : 'suggestion'} bold>{pt}</Text>}
      </Text>,
      <Text>
        <Text dimColor>{'turns    '}</Text>
        {t.count}
        <Text dimColor>{t.count ? `  last ${seconds(t.lastMs)}, ${t.tools} tool${t.tools === 1 ? '' : 's'}` : ''}</Text>
      </Text>,
      ...(ag.length === 0 ? [] : [
        <Text> </Text>,
        <Box flexDirection="row">
          <Text dimColor>agents  {ag.filter(a => a.status === 'running').length} running · {ag.filter(a => a.status === 'done').length} done  </Text>
          <Button key="agents" plain hotkey="a" label={open ? '▾ hide' : '▸ show'} onPress={() => update($, agentsOpen, v => !v)} />
        </Box>,
        ...(open ? ag.slice().reverse() : []).map(a => {
          const pct = a.tokens === undefined ? undefined : Math.min(100, Math.round((a.tokens / window) * 100))
          const tone: Color = pct === undefined ? 'inactive' : zone(pct)
          // One row each: glyph, type, bar, percent, then stats; the task only where room is left.
          const stats = `${a.tokens !== undefined ? `${Math.round(a.tokens / 1000)}k ` : ''}${a.tools}t ${seconds((a.endedAt ?? now) - a.startedAt)}`
          const room = e.props.bodyColumns - (2 + 10 + 1 + 8 + 5 + 1 + stats.length + 2)
          return (
            <Text wrap="truncate-end">
              <Text color={a.status === 'running' ? 'claude' : 'inactive'}>{a.status === 'running' ? '▶ ' : '✓ '}</Text>
              <Text bold={a.status === 'running'}>{a.type.slice(0, 10).padEnd(10)} </Text>
              <Text color={tone}>{bar(pct ?? 0, 8)}</Text>
              <Text color={tone} bold>{pct === undefined ? ' ––%' : ` ${String(pct).padStart(3)}%`}</Text>
              <Text dimColor> {stats}{room >= 8 ? `  ${a.description.slice(0, room)}` : ''}</Text>
            </Text>
          )
        }),
      ]),
    ]

    if (theme === 'minimal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      return <Box flexDirection="column">{facts({ Box, Text, Button })}</Box>
    }

    const extra = EXTRA.find(x => x.id === theme)
    if (e.surface === 'terminal' && extra) {
      const [main, second, third] = all as [Dial, Dial, Dial]
      const ctx: ThemeCtx = {
        ui: $.ui.resolve(e),
        main, second, third,
        warned: d => d.limit !== undefined && d.limit.kind in warn,
        reset: d => (d.limit?.resetsAt ? `↻ ${until(d.limit.resetsAt, now)}` : d.limit ? '' : 'no reading'),
        empty: d => `! empty in ${until(new Date(warn[d.limit?.kind ?? ''] ?? now).toISOString(), now)}`,
        context: { percent: p, tokens: u?.tokens, window, usd: u?.usd },
        turn: t,
        running: ag.filter(a => a.status === 'running').length,
        facts: [],
      }
      return extra.draw(ctx) as ReturnType<typeof facts>[number]
    }

    if (e.surface === 'terminal' && theme === 'silver-bezel') {
      const { Box, Text, Button, Raster } = $.ui.resolve(e)
      const [main, second, third] = all as [Dial, Dial, Dial]
      const warned = (d: Dial) => d.limit !== undefined && d.limit.kind in warn
      const reset = (d: Dial) => (d.limit?.resetsAt ? `↻ ${until(d.limit.resetsAt, now)}` : d.limit ? '' : 'no reading')
      const empty = (d: Dial) => `! empty in ${until(new Date(warn[d.limit?.kind ?? ''] ?? now).toISOString(), now)}`
      const silver = (text: string) => <Text color={SN.silver} wrap="truncate-end">{text}</Text>
      const big = (d: Dial, slot: string) => (
        <Box flexDirection="column" width={MJ} flexShrink={0} alignItems="center">
          <Raster key={`dial-${slot}`} columns={MJ} rows={MJ / 2} cells={d.cells(d.limit?.percent, warned(d))} />
          <Text color="#ffffff" bold>{reading(d)}</Text>
          {silver(d.label)}
          {/* A blank line for a dial with no reset, so the big gauges keep one baseline. */}
          <Text dimColor wrap="truncate-end">{line(reset(d))}</Text>
          {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
        </Box>
      )
      const running = ag.filter(a => a.status === 'running').length
      // In the fuel, temp, oil and boost spots: what is left of the second
      // gauge (the weekly window by default), context, last turn's tools (full
      // at 20), running agents (full at 5). The fuel gauge is too narrow for a
      // label, so the second gauge's own label, percent and reset sit under the four.
      const small = (key: string, label: string, gauge: number | undefined, value: string, warnIt = false) => (
        <Box flexDirection="column" width={12} flexShrink={0} alignItems="center">
          <Raster key={key} columns={MN} rows={MN / 2} cells={key === 'fuel' ? second.cells(gauge, warnIt) : minorCells(gauge, warnIt)} />
          <Text wrap="truncate-end"><Text color={SN.silver}>{label} </Text><Text color="#ffffff" bold>{value}</Text></Text>
        </Box>
      )
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1} paddingX={1} backgroundColor={SN.panel} alignItems="flex-start">
            {big(main, 'main')}
            <Box flexDirection="column" width={25} flexShrink={0} alignItems="center">
              <Box flexDirection="row" columnGap={1}>
                {small('fuel', 'LEFT', second.limit?.percent, second.limit ? `${100 - second.limit.percent}%` : '––%', warned(second))}
                {small('temp', 'CONTEXT', p, pct(p))}
              </Box>
              <Box flexDirection="row" columnGap={1}>
                {small('oil', 'TOOLS', Math.min(100, t.tools * 5), `${t.tools}`)}
                {small('boost', 'AGENTS', Math.min(100, running * 20), `${running}`)}
              </Box>
              <Text color={SN.silver} wrap="truncate-end">{[second.label, reading(second), reset(second)].filter(Boolean).join(' ')}</Text>
              {warned(second) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(second)} `}</Text> : <Text> </Text>}
            </Box>
            {big(third, 'third')}
          </Box>
        </Box>
      )
    }

    if (e.surface === 'terminal' && theme === 'eighties-digital-dash') {
      const { Box, Text, Button, Raster } = $.ui.resolve(e)
      const [main, second, third] = all as [Dial, Dial, Dial]
      const warned = (d: Dial) => d.limit !== undefined && d.limit.kind in warn
      const reset = (d: Dial) => (d.limit?.resetsAt ? `↻ ${until(d.limit.resetsAt, now)}` : d.limit ? '' : 'no reading')
      const empty = (d: Dial) => `! empty in ${until(new Date(warn[d.limit?.kind ?? ''] ?? now).toISOString(), now)}`
      const amber = (text: string, bold = false) => <Text color={LCD.digit} bold={bold} wrap="truncate-end">{text}</Text>
      // An amber-ruled readout like the oil and coolant boxes.
      const readout = (label: string, value: string) => [
        amber(`╭${'─'.repeat(12)}╮`),
        amber(`│${label.slice(0, 7).padEnd(7)}${value.slice(0, 5).padStart(5)}│`, true),
        amber(`╰${'─'.repeat(12)}╯`),
      ]
      const gauge = (d: Dial, digitsLeft: boolean, slot: string) => (
        <Box flexDirection="column" width={SW} flexShrink={0} alignItems={digitsLeft ? 'flex-start' : 'flex-end'}>
          <Raster key={`dial-${slot}`} columns={SW} rows={SR} cells={d.cells(d.limit?.percent, warned(d))} />
          <Text color={LCD.digit} bold wrap="truncate-end">{reading(d)}</Text>
          <Text color={LCD.digit} wrap="truncate-end">{d.label}</Text>
          {/* A blank line for a dial with no reset, so the sweeps keep one baseline. */}
          <Text dimColor wrap="truncate-end">{line(reset(d))}</Text>
          {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
        </Box>
      )
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1} paddingX={1} backgroundColor={LCD.panel} alignItems="flex-start">
            {gauge(main, true, 'main')}
            <Box flexDirection="column" alignItems="center" width={36} flexShrink={0}>
              <Box flexDirection="row" columnGap={1}>
                <Box flexDirection="column" width={14} flexShrink={0}>
                  {readout('CONTEXT', pct(p))}
                  {amber(' RANGE  TRIP', false)}
                  {amber(` ${u?.tokens !== undefined ? `${Math.round(u.tokens / 1000)}k` : '–'} tok`, true)}
                </Box>
                <Box flexDirection="column" alignItems="center" width={FW} flexShrink={0}>
                  <Raster key="fuel" columns={FW} rows={FR} cells={second.cells(second.limit?.percent, warned(second))} />
                </Box>
                <Box flexDirection="column" width={14} flexShrink={0}>
                  {readout('COST', u?.usd !== undefined ? `$${u.usd.toFixed(2)}` : '–')}
                  {amber(' TURN   TIME', false)}
                  {amber(` ${t.count}  ${t.count ? seconds(t.lastMs) : '–'}`, true)}
                </Box>
              </Box>
              {/* The second gauge's label and percent always show; a warned one adds the RESERVE lamp. */}
              {amber(`${second.label.toUpperCase()} ${reading(second)}`, true)}
              <Text dimColor wrap="truncate-end">{line(reset(second))}</Text>
              {warned(second) ? <Text color="error" bold inverse wrap="truncate-end">{` RESERVE ${empty(second)} `}</Text> : <Text> </Text>}
            </Box>
            {gauge(third, false, 'third')}
          </Box>
        </Box>
      )
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button, Raster } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={2} alignItems="flex-end">
            {all.map((d, i) => (
              <Box flexDirection="column" width={d.w}>
                <Raster key={`dial-${i}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, d.limit !== undefined && d.limit.kind in warn)} />
                <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>
                  {centered(reading(d), d.w)}
                </Text>
                <Text dimColor>{centered(d.label, d.w)}</Text>
                <Text dimColor>{centered(d.limit?.resetsAt ? `↻ ${until(d.limit.resetsAt, now)}` : d.limit ? '' : 'no reading', d.w) || ' '}</Text>
                {/* Always present so the dials sit on one baseline. */}
                <Text color="error" bold>{d.limit && d.limit.kind in warn ? centered(`! empty in ${until(new Date(warn[d.limit.kind] ?? now).toISOString(), now)}`, d.w) : ' '}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {all.map(d => (
          <Text>
            <Text dimColor>{d.label.padEnd(14)}</Text>
            <Text color={d.limit ? zone(d.limit.percent) : 'inactive'}>{bar(d.limit?.percent ?? 0, 20)}</Text>
            <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{` ${reading(d)}`}</Text>
            <Text dimColor>{d.limit?.resetsAt ? `  ↻ ${until(d.limit.resetsAt, now)}` : d.limit ? '' : '  no reading'}</Text>
            {d.limit && d.limit.kind in warn && (
              <Text color="error" bold>{`  ! empty in ${until(new Date(warn[d.limit.kind] ?? now).toISOString(), now)}`}</Text>
            )}
          </Text>
        ))}
      </Box>
    )
  })
}

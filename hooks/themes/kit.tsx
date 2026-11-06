// The drawing kit every theme shares: raster encoding, the zone colours, the
// classic half-dial, and the text helpers. Theme files under hooks/themes/
// import from here, never from register.tsx, so no import runs in a circle.
import type { Color } from 'claude-code'

import type { SpeedoLimit, SpeedoTurn } from '../../types'

export const zone = (p: number): Color => (p >= 80 ? 'error' : p >= 50 ? 'warning' : 'success')

// Raw colors for the Raster: theme keys do not reach a cell.
export const PX = { green: 0x3fb950, yellow: 0xd29922, red: 0xf85149, track: 0x303030, needle: 0xf2f2f2, none: 0x01000000 }
export const zonePx = (p: number) => (p >= 80 ? PX.red : p >= 50 ? PX.yellow : PX.green)

// Gauges are painted at half-row resolution with ▀ and ▄ (a half-row is about
// one column wide, so the pixels are near square), from a pixel grid pw by ph.
export function encode(px: Uint32Array, pw: number, ph: number): string {
  const rows = ph / 2
  const words = new Uint32Array(pw * rows * 3)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < pw; col += 1) {
      const top = px[(2 * row) * pw + col] ?? PX.none
      const bot = px[(2 * row + 1) * pw + col] ?? PX.none
      const i = (row * pw + col) * 3
      if (top === PX.none && bot === PX.none) words.set([0x20, PX.none, PX.none], i)
      else if (top === PX.none) words.set([0x2584, bot, PX.none], i)
      else words.set([0x2580, top, bot], i)
    }
  }
  // toBase64 is in the module environment but not in the es2023 lib typings.
  return (new Uint8Array(words.buffer) as unknown as { toBase64(): string }).toBase64()
}

export const clamp = (percent: number | undefined) => (percent === undefined ? -1 : Math.max(0, Math.min(100, percent)) / 100)

// A half-dial with a needle; the classic cluster is three of them, DW wide.
export const DW = 21
export const dialRows = (w: number) => Math.ceil(((w - 1) / 2 + 1) / 2)

export function dialCells(percent: number | undefined, warn = false, w = DW): string {
  const pw = w
  const ph = dialRows(w) * 2
  const cx = (pw - 1) / 2
  const cy = ph - 1
  const ro = cx
  const ri = ro * 0.65
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (dy < 0 || r < ri || r > ro + 0.4) continue
      const frac = 1 - Math.atan2(dy, dx) / Math.PI
      px[y * pw + x] = frac <= fill ? zonePx(frac * 100) : PX.track
    }
  }
  if (fill >= 0) {
    const t = Math.PI * (1 - fill)
    for (let r = 0; r < ri - 0.5; r += 0.5) {
      px[Math.round(cy - r * Math.sin(t)) * pw + Math.round(cx + r * Math.cos(t))] = PX.needle
    }
  }
  if (warn) {
    for (let y = cy - 2; y <= cy; y += 1) for (let x = cx - 1; x <= cx + 1; x += 1) px[y * pw + x] = PX.red
  }
  return encode(px, pw, ph)
}

export const bar = (p: number, width = 10) => {
  const on = Math.round((Math.max(0, Math.min(100, p)) / 100) * width)
  return '▰'.repeat(on) + '▱'.repeat(width - on)
}

export const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  if (mins >= 1440) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
  return mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m` : `${mins}m`
}

// Round once to whole seconds so 359.6 s reads 6m0s, not 5m60s.
export const seconds = (ms: number) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s` }

// A gauge: its width and height in cells, and how it paints a percent (or
// none, as undefined) and whether its window is warned.
export type Gauge = { w: number; rows: number; cells: (percent: number | undefined, warn: boolean) => string }
// What a gauge slot can show. Set per slot under /config (`gauge1`, `gauge2`,
// `gauge3`); `auto` there picks one from what the plan reports.
export const SOURCES = ['five-hour', 'weekly', 'model-weekly', 'context'] as const
export type Source = (typeof SOURCES)[number]
// A gauge bound to one source: which it is, its label, and its reading if any.
// A `context` dial's limit has no resetsAt and is never warned.
export type Dial = Gauge & { source: Source; label: string; limit?: SpeedoLimit }

export const arc = (w: number): Gauge => ({ w, rows: dialRows(w), cells: (p, warn) => dialCells(p, warn, w) })

// The README groups the clusters by this.
export type Category = 'classic' | 'vehicles' | 'beyond'

// What a theme's draw() gets: the drawing surface's elements, the three dials
// (main, second, third) as the theme's gauges() built them, and the
// readings a cluster prints beside its gauges.
export type ThemeCtx = {
  // The terminal's elements: Box, Text, Button, Raster.
  ui: any
  // The three gauge slots, in the order gauges() built them. What each shows
  // is configured (see Source); draw by slot, and print each dial's label.
  main: Dial
  second: Dial
  third: Dial
  // Deprecated aliases of main, second and third, kept while themes move over.
  five: Dial
  week: Dial
  model: Dial
  // True when the burn rate says this dial's window runs out before its reset.
  warned: (d: Dial) => boolean
  // `↻ 2h14m` to the reset, '' when the window has no reset, `no reading` with no window.
  reset: (d: Dial) => string
  // `! empty in 1h35m`, for a warned dial.
  empty: (d: Dial) => string
  context: { percent?: number; tokens?: number; window: number; usd?: number }
  turn: SpeedoTurn
  // Subagents running now.
  running: number
  // The facts rows (context, cost, turns, agents). Only the minimal theme
  // shows them, so a gauge theme gets none and draws none.
  facts: unknown[]
}

export type ThemeDef = {
  // The /config value, lowercase-kebab.
  id: string
  category: Category
  // The three gauges, in slot order: main, second, third.
  gauges: (main: Omit<Dial, keyof Gauge>, second: Omit<Dial, keyof Gauge>, third: Omit<Dial, keyof Gauge>) => [Dial, Dial, Dial]
  // The pane's tree on the terminal surface.
  draw: (ctx: ThemeCtx) => unknown
}

// A stand-in theme: three classic dials in a row. A theme file
// starts from this and replaces both halves.
export const placeholder = (id: string, category: Category): ThemeDef => ({
  id,
  category,
  gauges: (five, week, model) => [{ ...five, ...arc(DW) }, { ...week, ...arc(DW) }, { ...model, ...arc(DW) }],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty }) => (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={2}>
        {[five, week, model].map(d => (
          <Box flexDirection="column" width={d.w} flexShrink={0} alignItems="center">
            <Raster key={`dial-${d.label}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
            <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{d.limit ? `${d.limit.percent}%` : '––%'}</Text>
            <Text dimColor wrap="truncate-end">{d.label}</Text>
            <Text dimColor wrap="truncate-end">{reset(d)}</Text>
            <Text color="error" bold wrap="truncate-end">{warned(d) ? empty(d) : ' '}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  ),
})

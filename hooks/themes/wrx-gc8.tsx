// The wrx-gc8 cluster, after the 1990s first-generation turbo saloon's dash:
// a black hooded binnacle over black-faced gauges with crisp white markings,
// orange-red needles and a red redline arc, all in the orange glow their
// backlights gave off at night. A big tachometer in the middle, the
// speedometer and a second main gauge either side, and small temperature,
// fuel, boost and tool gauges at the outer edges.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const GC = {
  shell: 0x1e1e1e, lip: 0x4a4a4a, well: 0x070605, glow: [0x2e1104, 0x150802], rim: 0x2a1405, bezel: 0x2c2c2c,
  face: 0x0b0b0b, tick: 0xf0f0f0, minor: 0x9a9a9a, red: 0xe02020, needle: 0xff4a14, hub: 0x3a3a3a, cap: 0xff7a2a,
  vacuum: 0x6a6a6a, boost: 0xff7a1a, lamp: 0xff2020,
  panel: '#121110', white: '#f0f0f0', orange: '#ff8a3a', grey: '#8a8580',
}

// What a round gauge carries: its needle sweep clockwise from angle a0 to a1
// (radians, 0 is right), its long ticks, where its red arc starts (above 1 for
// none), where a low red arc ends (below 0 for none), the 3 by 5 numerals to
// print at which ticks, and whether its scale runs vacuum then boost.
type Face = { a0: number; a1: number; ticks: number; redFrom: number; redTo?: number; numerals?: number[]; boost?: boolean }

const SWEEP = { a0: Math.PI * 7 / 6, a1: Math.PI * -1 / 6 }
const TACH: Face = { ...SWEEP, ticks: 8, redFrom: 0.875, numerals: [2, 4, 6] }
const MAIN: Face = { ...SWEEP, ticks: 8, redFrom: 0.85 }
const TEMP: Face = { a0: Math.PI * 0.85, a1: Math.PI * 0.15, ticks: 2, redFrom: 0.8 }
const FUEL: Face = { a0: Math.PI * 0.85, a1: Math.PI * 0.15, ticks: 2, redFrom: 2, redTo: 0.15 }
const BOOST: Face = { a0: Math.PI * 0.85, a1: Math.PI * 0.15, ticks: 2, redFrom: 0.9, boost: true }
const TOOLS: Face = { a0: Math.PI * 0.85, a1: Math.PI * 0.15, ticks: 2, redFrom: 0.8 }

const FONT: Record<number, string[]> = {
  2: ['###', '..#', '###', '#..', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  6: ['###', '#..', '###', '#.#', '###'],
}

const swept = (f: Face, dx: number, dy: number) => {
  let ang = f.a0 - Math.atan2(dy, dx)
  while (ang < 0) ang += 2 * Math.PI
  while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
  return ang / (f.a0 - f.a1)
}

// The night glow: an orange halo fading out from a gauge's bezel into the
// well. Painted for every gauge before any face, so faces sit over halos.
function halo(px: Uint32Array, pw: number, cx: number, cy: number, R: number) {
  const ph = px.length / pw
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      if (px[y * pw + x] !== GC.well) continue
      const ring = Math.floor(Math.hypot(x - cx, cy - y) - R - 0.3)
      if (ring >= 0 && ring < GC.glow.length) px[y * pw + x] = GC.glow[ring]!
    }
  }
}

// One round gauge of radius R centred (cx, cy): bezel, black face, red arcs,
// white ticks and numerals, the needle and its orange cap, and a red lamp low
// on the face when its window is warned.
function face(px: Uint32Array, pw: number, cx: number, cy: number, R: number, f: Face, fill: number, warn: boolean) {
  const ph = px.length / pw
  const big = R >= 8
  const span = R * (f.a0 - f.a1)
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      if (r > R - 0.9) { px[y * pw + x] = GC.bezel; continue }
      // The backlight: a faint orange rim just inside the bezel.
      px[y * pw + x] = r > R - 1.7 ? GC.rim : GC.face
      const frac = swept(f, dx, dy)
      if (frac > 1.0001) continue
      const outer = r > R - (big ? 2.1 : 1.9)
      if (outer && (frac >= f.redFrom || (f.redTo !== undefined && frac <= f.redTo))) { px[y * pw + x] = GC.red; continue }
      // The boost gauge's scale: grey vacuum up to zero, orange boost past it.
      if (f.boost && r > R - 1.6 && frac < f.redFrom) { px[y * pw + x] = frac < 0.5 ? GC.vacuum : GC.boost; continue }
      const major = Math.abs(frac * f.ticks - Math.round(frac * f.ticks)) * span / f.ticks < 0.5
      const minor = big && Math.abs(frac * f.ticks * 2 - Math.round(frac * f.ticks * 2)) * span / (f.ticks * 2) < 0.35
      if (major && r > R - (R >= 11 ? 3.6 : big ? 3 : 2.6)) px[y * pw + x] = frac >= f.redFrom ? GC.red : GC.tick
      else if (minor && r > R - 2.4) px[y * pw + x] = GC.minor
    }
  }
  for (const n of f.numerals ?? []) {
    const t = f.a0 - (n / f.ticks) * (f.a0 - f.a1)
    const nx = Math.round(cx + (R - 6.2) * Math.cos(t) - 1)
    const ny = Math.round(cy - (R - 6.2) * Math.sin(t) - 2)
    FONT[n]!.forEach((line, gy) => [...line].forEach((c, gx) => { if (c === '#') px[(ny + gy) * pw + nx + gx] = n / f.ticks >= f.redFrom ? GC.red : GC.tick }))
  }
  if (fill >= 0) {
    const t = f.a0 - fill * (f.a0 - f.a1)
    for (let r = big ? -1.6 : 0; r < R - 1.4; r += 0.4) px[Math.round(cy - r * Math.sin(t)) * pw + Math.round(cx + r * Math.cos(t))] = GC.needle
  }
  const hub: [number, number][] = big
    ? [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]
    : [[Math.round(cx), Math.round(cy)]]
  for (const [x, y] of hub) px[y * pw + x] = big ? GC.hub : GC.cap
  if (big) px[Math.round(cy) * pw + Math.round(cx)] = GC.cap
  if (warn) {
    const y = Math.round(cy + R * 0.5)
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) { px[(y - 1) * pw + x] = GC.lamp; px[y * pw + x] = GC.lamp }
  }
}

// One gauge on its own, w pixels across (w even), for the tests and any
// width: the face over a patch of well with its glow.
export function gc8Cells(w: number, percent: number | undefined, warn = false, f: Face = MAIN): string {
  const px = new Uint32Array(w * w).fill(GC.well)
  const c = (w - 1) / 2
  halo(px, w, c, c, w / 2 - 2.4)
  face(px, w, c, c, w / 2 - 2.4, f, clamp(percent), warn)
  return encode(px, w, w)
}
export const tachCells = (p: number | undefined, warn = false) => gc8Cells(24, p, warn, TACH)
export const mainCells = (p: number | undefined, warn = false) => gc8Cells(18, p, warn, MAIN)
export const smallCells = (p: number | undefined, warn = false) => gc8Cells(10, p, warn, BOOST)

// The whole binnacle in one raster: the hood's shell arching over a dark
// well, the four small gauges at the outer edges, the speedometer and the
// second main gauge either side, and the tachometer in the middle.
// Left to right: temp over fuel, weekly, 5-hour, model weekly, boost over tools.
export const CW = 86
export const CR = 14
export type Readings = {
  five?: number; week?: number; model?: number; context?: number; tools: number; agents: number; warn: [boolean, boolean, boolean]
}
export function clusterCells(r: Readings, pw = CW, rows = CR): string {
  const ph = rows * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const mid = (pw - 1) / 2
  // The hood: its top edge an arch, highest in the middle, with a lit lip;
  // its sides drop to the bottom. Inside is the well.
  const top = (x: number) => 5.2 * ((x - mid) / mid) ** 2
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const d = y - top(x)
      if (d < 0) continue
      const side = x < 2 || x > pw - 3
      px[y * pw + x] = d < 1 ? GC.lip : d < 2.4 || side ? GC.shell : GC.well
    }
  }
  const s = pw / CW
  const at = (x: number) => mid + (x - 42.5) * s
  const gauges: [number, number, number, Face, number, boolean][] = [
    [at(7), 10, 4.6, TEMP, clamp(r.context), false],
    [at(7), 21.5, 4.6, FUEL, r.context === undefined ? -1 : 1 - clamp(r.context), false],
    [at(78), 10, 4.6, BOOST, clamp(Math.min(100, r.agents * 20)), false],
    [at(78), 21.5, 4.6, TOOLS, clamp(Math.min(100, r.tools * 5)), false],
    [at(21.5), 16.5, 8.6, MAIN, clamp(r.week), r.warn[1]],
    [at(63.5), 16.5, 8.6, MAIN, clamp(r.model), r.warn[2]],
    [at(42.5), 15, 11.6, TACH, clamp(r.five), r.warn[0]],
  ]
  for (const [cx, cy, R] of gauges) halo(px, pw, cx, cy, R)
  for (const [cx, cy, R, f, fill, warn] of gauges) face(px, pw, cx, cy, R, f, fill, warn)
  return encode(px, pw, ph)
}

export const theme: ThemeDef = {
  id: 'wrx-gc8',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: 24, rows: 12, cells: tachCells },
    { ...week, w: 18, rows: 9, cells: mainCells },
    { ...model, w: 18, rows: 9, cells: mainCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    // The window's lines under its gauge: percent and label, reset, warning.
    const under = (d: Dial, w: number) => (
      <Box flexDirection="column" width={w} flexShrink={0} alignItems="center">
        <Text wrap="truncate-end"><Text color={GC.white} bold>{d.limit ? `${d.limit.percent}%` : '––%'}</Text><Text color={GC.orange}> {d.label}</Text></Text>
        <Text color={GC.grey} wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{w > 20 ? ` ${empty(d)} ` : empty(d)}</Text> : <Text> </Text>}
      </Box>
    )
    const outer = (lines: [string, string][]) => (
      <Box flexDirection="column" width={13} flexShrink={0} alignItems="center">
        {lines.map(([k, v]) => <Text wrap="truncate-end"><Text color={GC.orange}>{k} </Text><Text color={GC.white} bold>{v}</Text></Text>)}
      </Box>
    )
    const p = context.percent
    const left = p === undefined || context.tokens === undefined ? '––' : `${Math.max(0, Math.round((context.window - context.tokens) / 1000))}k`
    const cells = clusterCells({
      five: five.limit?.percent, week: week.limit?.percent, model: model.limit?.percent, context: p,
      tools: turn.tools, agents: running, warn: [warned(five), warned(week), warned(model)],
    })
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} backgroundColor={GC.panel} alignItems="flex-start">
          <Raster key="binnacle" columns={CW} rows={CR} cells={cells} />
          <Box flexDirection="row">
            {outer([['TEMP', p === undefined ? '––%' : `${p}%`], ['FUEL', left]])}
            {under(week, 17)}
            {under(five, 26)}
            {under(model, 17)}
            {outer([['BOOST', `${running}`], ['TOOLS', `${turn.tools}`]])}
          </Box>
        </Box>
      </Box>
    )
  },
}

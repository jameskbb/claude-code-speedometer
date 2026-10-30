// The porsche-911 cluster, after the classic five-gauge 911 dash: five round
// black-faced gauges in a row, each overlapping the next, the tachometer the
// biggest and in front in the middle. White ticks and numerals, orange needles, a red
// band at the top of the tach's scale, thin silver bezels.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const NB = {
  panel: '#0c0c0c', face: 0x141414, bezel: 0x8a8a8a, rim: 0x050505, tick: 0xededed, needle: 0xff6a1a, hub: 0x5a5a5a,
  red: 0xe0262a, white: '#ededed', grey: '#8a8a8a',
}

// What one round gauge carries: its needle sweep, clockwise from angle a0 to
// a1 (radians, 0 is right), its tick count, where its red band starts (above
// 1 for none) and whether to number the majors.
type Face = { a0: number; a1: number; ticks: number; redFrom: number; numerals?: boolean }

const TACH: Face = { a0: Math.PI * 1.25, a1: Math.PI * -0.25, ticks: 8, redFrom: 0.8, numerals: true }
const SIDE: Face = { a0: Math.PI * 1.25, a1: Math.PI * -0.25, ticks: 8, redFrom: 0.9 }
const SMALL: Face = { a0: Math.PI * 1.25, a1: Math.PI * -0.25, ticks: 4, redFrom: 2 }
// The combination gauge: one needle across the upper half, one across the lower.
const UPPER: Face = { a0: Math.PI * 0.8, a1: Math.PI * 0.2, ticks: 2, redFrom: 2 }
const LOWER: Face = { a0: Math.PI * -0.8, a1: Math.PI * -0.2, ticks: 2, redFrom: 2 }

// A 3 by 5 font for the tach's numerals.
const FONT: Record<string, string[]> = {
  '2': ['###', '..#', '###', '#..', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'],
  '6': ['###', '#..', '###', '#.#', '###'],
}

const swept = (f: Face, dx: number, dy: number) => {
  const span = Math.abs(f.a0 - f.a1)
  let ang = (f.a0 > f.a1 ? f.a0 - Math.atan2(dy, dx) : Math.atan2(dy, dx) - f.a0)
  while (ang < 0) ang += 2 * Math.PI
  while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
  return ang / span
}

// Paints one round gauge of radius R centred (cx, cy) into px, over whatever
// is there: bezel, black face, ticks, numerals, then a needle per scale.
function face(px: Uint32Array, pw: number, cx: number, cy: number, R: number, scales: [Face, number][], warn: boolean) {
  const ph = px.length / pw
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      if (r > R - 0.9) { px[y * pw + x] = NB.bezel; continue }
      if (r > R - 1.6) { px[y * pw + x] = NB.rim; continue }
      px[y * pw + x] = NB.face
      // The red band along the outside of the scale's top.
      for (const [f] of scales) if (r > R - 2.6 && swept(f, dx, dy) <= 1.0001 && swept(f, dx, dy) >= f.redFrom) px[y * pw + x] = NB.red
    }
  }
  // Ticks drawn as short radial strokes, every other one longer.
  for (const [f] of scales) {
    for (let i = 0; i <= f.ticks; i += 1) {
      const t = f.a0 - (i / f.ticks) * (f.a0 - f.a1)
      const len = i % 2 === 0 ? 2.2 : 1.2
      for (let r = R - 1.7; r >= R - 1.7 - len + 0.5; r -= 0.3) px[Math.round(cy - r * Math.sin(t)) * pw + Math.round(cx + r * Math.cos(t))] = i / f.ticks >= f.redFrom ? NB.red : NB.tick
    }
  }
  for (const [f] of scales) {
    if (!f.numerals) continue
    for (const [n, glyph] of Object.entries(FONT)) {
      const t = f.a0 - (Number(n) / f.ticks) * (f.a0 - f.a1)
      const nx = Math.round(cx + (R - 6.5) * Math.cos(t) - 1)
      const ny = Math.round(cy - (R - 6.5) * Math.sin(t) - 2)
      glyph.forEach((line, gy) => [...line].forEach((c, gx) => { if (c === '#') px[(ny + gy) * pw + nx + gx] = Number(n) / f.ticks >= f.redFrom ? NB.red : NB.tick }))
    }
  }
  for (const [f, fill] of scales) {
    if (fill < 0) continue
    const t = f.a0 - fill * (f.a0 - f.a1)
    for (let r = 0; r < R - 2.2; r += 0.4) px[Math.round(cy - r * Math.sin(t)) * pw + Math.round(cx + r * Math.cos(t))] = NB.needle
  }
  for (const [x, y] of [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]) px[y! * pw + x!] = NB.hub
  // The warning lamp: a red block low on the face.
  if (warn) for (let y = Math.round(cy + R * 0.45); y <= Math.round(cy + R * 0.45) + 1; y += 1) for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) px[y * pw + x] = NB.red
}

const one = (w: number, scales: [Face, number][], warn: boolean) => {
  const px = new Uint32Array(w * w).fill(PX.none)
  face(px, w, (w - 1) / 2, (w - 1) / 2, w / 2 - 0.1, scales, warn)
  return encode(px, w, w)
}

export const TW = 26
export const SW = 20
export const OW = 16
// The tachometer, numbered 2, 4 and 6, its last fifth red.
export const tachCells = (percent: number | undefined, warn = false) => one(TW, [[TACH, clamp(percent)]], warn)
// The speedometer and the oil gauge either side of it.
export const sideCells = (percent: number | undefined, warn = false) => one(SW, [[SIDE, clamp(percent)]], warn)
// The outer gauges: a plain one, and the combination one with two needles.
export const smallCells = (percent: number | undefined, warn = false) => one(OW, [[SMALL, clamp(percent)]], warn)
export const comboCells = (upper: number | undefined, lower: number | undefined) => one(OW, [[UPPER, clamp(upper)], [LOWER, clamp(lower)]], false)

// The whole dash in one raster, so the gauges can overlap: outer gauges
// first, then the flanking pair, then the tach on top. Left to right:
// context, weekly, 5-hour, model weekly, and tools over agents.
export const CW = 82
export const CR = 13
export type Readings = { five?: number; week?: number; model?: number; context?: number; tools: number; agents: number; warn: [boolean, boolean, boolean] }
export function clusterCells(r: Readings): string {
  const pw = CW
  const ph = CR * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const cy = (ph - 1) / 2
  face(px, pw, 7.5, cy, OW / 2 - 0.1, [[SMALL, clamp(r.context)]], false)
  face(px, pw, 73.5, cy, OW / 2 - 0.1, [[UPPER, clamp(Math.min(100, r.tools * 5))], [LOWER, clamp(Math.min(100, r.agents * 20))]], false)
  face(px, pw, 21.5, cy, SW / 2 - 0.1, [[SIDE, clamp(r.week)]], r.warn[1])
  face(px, pw, 59.5, cy, SW / 2 - 0.1, [[SIDE, clamp(r.model)]], r.warn[2])
  face(px, pw, 40.5, cy, TW / 2 - 0.1, [[TACH, clamp(r.five)]], r.warn[0])
  return encode(px, pw, ph)
}

export const theme: ThemeDef = {
  id: 'porsche-911',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: TW, rows: TW / 2, cells: tachCells },
    { ...week, w: SW, rows: SW / 2, cells: sideCells },
    { ...model, w: SW, rows: SW / 2, cells: sideCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    // The window's lines under its gauge.
    const under = (d: Dial, w: number) => (
      <Box flexDirection="column" width={w} flexShrink={0} alignItems="center">
        <Text color={NB.white} bold>{pct(d)}</Text>
        <Text color={NB.white} wrap="truncate-end">{d.label}</Text>
        <Text color={NB.grey} wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{w > 20 ? ` ${empty(d)} ` : empty(d)}</Text> : <Text> </Text>}
      </Box>
    )
    const outer = (lines: [string, string][]) => (
      <Box flexDirection="column" width={10} flexShrink={0} alignItems="center">
        {lines.map(([k, v]) => <Text wrap="truncate-end"><Text color={NB.grey}>{k} </Text><Text color={NB.white} bold>{v}</Text></Text>)}
      </Box>
    )
    const cells = clusterCells({
      five: five.limit?.percent, week: week.limit?.percent, model: model.limit?.percent, context: context.percent,
      tools: turn.tools, agents: running, warn: [warned(five), warned(week), warned(model)],
    })
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} backgroundColor={NB.panel} alignItems="flex-start">
          <Raster key="dash" columns={CW} rows={CR} cells={cells} />
          <Box flexDirection="row">
            {outer([['CTX', context.percent === undefined ? '––%' : `${context.percent}%`], ['COST', context.usd !== undefined ? `$${context.usd.toFixed(2)}` : '–']])}
            {under(week, 19)}
            {under(five, 24)}
            {under(model, 19)}
            {outer([['TOOLS', `${turn.tools}`], ['AGENTS', `${running}`]])}
          </Box>
        </Box>
      </Box>
    )
  },
}

// The tron-lightcycle cluster, after the light cycle look of the 1982 film
// and its 2010 sequel: a black void, gauges as glowing neon rings like the
// identity discs, lit clockwise from the top with a white-hot head, and a
// grid floor running to a lit horizon below them, where two light trails
// race in from either side. Cyan for the user's windows, orange for the
// model's, as the two riders' colours.
import { clamp, encode, PX } from './kit'
import type { Dial, Gauge, ThemeCtx, ThemeDef } from './kit'

type Glow = { core: number; glow: number; dim: number; text: string; soft: string }
const CYAN: Glow = { core: 0x8af8ff, glow: 0x1d9fb2, dim: 0x0b3138, text: '#8af8ff', soft: '#3fb6c6' }
const ORANGE: Glow = { core: 0xffb24a, glow: 0xc25a12, dim: 0x3a1c08, text: '#ffb24a', soft: '#c9772e' }
const VOID = { bg: 0x000000, grid: 0x0a4652, horizon: 0x8af8ff, head: 0xffffff, warn: 0xff2a2a, panel: '#000000' }
// The big centre ring, the two side rings, and the floor's width.
export const RB = 24
export const RS = 18
export const FLOOR = 86

// A neon ring w pixels across (w even): one thin dim track, lit clockwise
// from twelve o'clock up to the percent with a glow either side and a white
// head, and a thin inner circle round a hub like a disc's core.
// A warned window turns the inner circle and hub red.
export function ringCells(w: number, percent: number | undefined, warn: boolean, c: Glow = CYAN): string {
  const pw = w
  const ph = w
  const cx = (pw - 1) / 2
  const cy = (ph - 1) / 2
  const R = pw / 2 - 0.3
  const fill = clamp(percent)
  const px = new Uint32Array(pw * ph).fill(VOID.bg)
  const inner = R * 0.42
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      let frac = Math.atan2(dx, dy) / (2 * Math.PI)
      if (frac < 0) frac += 1
      const lit = frac <= fill
      const i = y * pw + x
      if (r > R + 0.2) px[i] = PX.none
      else if (r > R - 0.8) px[i] = lit ? c.glow : VOID.bg
      else if (r > R - 1.9) px[i] = lit ? (Math.abs(frac - fill) * 2 * Math.PI * r < 1.2 ? VOID.head : c.core) : c.dim
      else if (r > R - 2.6) px[i] = lit ? c.glow : VOID.bg
      else if (Math.abs(r - inner) < 0.5) px[i] = warn ? VOID.warn : c.glow
      else if (r < 1.2) px[i] = warn ? VOID.warn : c.core
    }
  }
  return encode(px, pw, ph)
}

export const bigRing = (p: number | undefined, warn = false) => ringCells(RB, p, warn, CYAN)
export const sideRing = (p: number | undefined, warn = false) => ringCells(RS, p, warn, CYAN)
export const modelRing = (p: number | undefined, warn = false) => ringCells(RS, p, warn, ORANGE)

// The grid floor, w pixels wide and five rows deep: a lit horizon on top,
// cross lines spreading out toward the viewer and floor lines fanning out
// from a vanishing point above the horizon. A cyan trail runs in from the
// left for the first percent, an orange one from the right for the second,
// each led by a white cycle head.
export const FR = 5
export function floorCells(w: number, left: number | undefined, right: number | undefined): string {
  const pw = w
  const ph = FR * 2
  const cx = (pw - 1) / 2
  const px = new Uint32Array(pw * ph).fill(VOID.bg)
  for (let x = 0; x < pw; x += 1) px[x] = VOID.horizon
  for (const y of [3, 6, 9]) for (let x = 0; x < pw; x += 1) px[y * pw + x] = VOID.grid
  // Each floor line steps from where it enters a row to just short of where
  // it leaves, so it reads as one thin diagonal however flat it runs.
  const at = (k: number, y: number) => cx + (k * 7 * (y + 4)) / (ph + 4)
  for (let k = -6; k <= 6; k += 1) {
    for (let y = 3; y < ph; y += 1) {
      const a = Math.round(at(k, y))
      const b = Math.round(at(k, y + 1))
      const step = Math.sign(b - a)
      for (let x = a; x === a || x !== b; x += step || 1) {
        if (x >= 0 && x < pw) px[y * pw + x] = VOID.grid
        if (step === 0) break
      }
    }
  }
  const trail = (frac: number, y: number, c: Glow, fromRight: boolean) => {
    if (frac < 0) return
    const len = Math.round(frac * (pw / 2 - 2))
    for (let n = 0; n < len; n += 1) {
      const x = fromRight ? pw - 1 - n : n
      px[y * pw + x] = n >= len - 2 ? VOID.head : c.core
      px[(y - 1) * pw + x] = c.glow
    }
  }
  trail(clamp(left), 7, CYAN, false)
  trail(clamp(right), 7, ORANGE, true)
  return encode(px, pw, ph)
}

const big: Gauge = { w: RB, rows: RB / 2, cells: bigRing }
const side: Gauge = { w: RS, rows: RS / 2, cells: sideRing }
const orange: Gauge = { w: RS, rows: RS / 2, cells: modelRing }

export const theme: ThemeDef = {
  id: 'tron-lightcycle',
  category: 'vehicles',
  gauges: (five, week, model) => [{ ...five, ...big }, { ...week, ...side }, { ...model, ...orange }],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const ring = (d: Dial, c: Glow, width: number) => (
      <Box flexDirection="column" width={width} flexShrink={0} alignItems="center">
        <Raster key={`dial-${d.label}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
        <Text color={c.text} bold>{d.limit ? `${d.limit.percent}%` : '––%'}</Text>
        <Text color={c.text} wrap="truncate-end">{d.label.toUpperCase()}</Text>
        <Text color={c.soft} wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    const p = context.percent
    // The trails: context from the left, the last turn's tool calls (full at 20) from the right.
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} backgroundColor={VOID.panel} alignItems="center">
          <Box flexDirection="row" columnGap={3} alignItems="flex-end">
            {ring(week, CYAN, RS + 2)}
            {ring(five, CYAN, RB)}
            {ring(model, ORANGE, RS + 2)}
          </Box>
          <Raster key="floor" columns={FLOOR} rows={FR} cells={floorCells(FLOOR, p, Math.min(100, turn.tools * 5))} />
          <Box flexDirection="row" width={FLOOR} justifyContent="space-between">
            <Text color={CYAN.text} bold>{`CONTEXT ${p === undefined ? '––' : `${p}%`}`}</Text>
            <Text color={CYAN.soft}>{`AGENTS ${running}`}</Text>
            <Text color={ORANGE.text} bold>{`TOOLS ${turn.tools}`}</Text>
          </Box>
        </Box>
      </Box>
    )
  },
}

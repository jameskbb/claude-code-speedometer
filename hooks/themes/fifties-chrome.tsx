// The fifties-chrome cluster, after the late-1950s two-tone dash: a turquoise
// upper dash with a chrome hood over a long curved glass window, where a
// coloured ribbon slides along a strip under the numbers, chrome fins either
// side, and an ivory lower dash with two small chrome-ringed gauges.
import { clamp, encode, line, pct, PX, reading } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const BA = {
  paint: 0x3fb8af, paintDark: 0x2a8f88, ivory: 0xf1e8d0, chrome: 0xe6e9ec, chromeMid: 0xb4b9be, chromeDark: 0x7c8186,
  glass: 0x101a1c, glare: 0x2c3c40, numeral: 0xf1e8d0, tick: 0x8fa3a6, track: 0x26302f,
  green: 0x4cc35a, amber: 0xf2a41c, red: 0xe5322d, needle: 0xf1e8d0, face: 0x161c1d,
}
// The text colours: dark ink on the ivory lower dash.
const TX = { ivory: '#f1e8d0', ink: '#1d2a29', soft: '#5d6b69', teal: '#1f7f78', green: '#23823a', amber: '#a7650a', red: '#c0262d' }

const bandPx = (f: number) => (f >= 0.8 ? BA.red : f >= 0.5 ? BA.amber : BA.green)
const inkFor = (p: number) => (p >= 80 ? TX.red : p >= 50 ? TX.amber : TX.green)

// A 3 by 5 font for the scale's numbers.
const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'],
  '6': ['###', '#..', '###', '#.#', '###'], '8': ['###', '#.#', '###', '#.#', '###'],
}

export const RW = 86
export const RROWS = 8
// Where 0 and 100 sit on the strip, and the strip's rows.
const S0 = 12
const S1 = 70
const BAND_TOP = 11
const BAND_BOT = 13

// The ribbon: a chrome-hooded glass window arching higher in the middle,
// numbers 0 to 100 over a tick row, and the band growing from the left,
// green to amber to red with a bright leading edge. A warned window lights a
// red jewel set in the top of the hood.
export function ribbonCells(percent: number | undefined, warn = false): string {
  const pw = RW
  const ph = RROWS * 2
  const px = new Uint32Array(pw * ph).fill(BA.paint)
  const set = (x: number, y: number, c: number) => { if (x >= 0 && x < pw && y >= 0 && y < ph) px[y * pw + x] = c }
  // The pod spans x0 to x1; its top edge curves down toward the ends.
  const x0 = 6
  const x1 = 79
  const cx = (x0 + x1) / 2
  const hw = (x1 - x0) / 2
  const topAt = (x: number) => Math.round(1 + 1.6 * ((x - cx) / hw) ** 2)
  const bot = 14
  for (let x = x0; x <= x1; x += 1) {
    const t = topAt(x)
    const end = x === x0 || x === x1
    for (let y = t; y <= bot; y += 1) {
      const edge = end || y <= t + 1 || y === bot
      set(x, y, edge ? (y <= t ? BA.chrome : y === bot ? BA.chromeDark : BA.chromeMid) : BA.glass)
    }
    // The glare along the curved glass, under the hood.
    if (!end) set(x, t + 2, BA.glare)
  }
  // The chrome fins either side, longest in the middle.
  for (const [y, len] of [[4, 3], [6, 5], [8, 6], [10, 5], [12, 3]] as const) {
    for (let i = 0; i < len; i += 1) { set(x0 - 1 - i, y, i === len - 1 ? BA.chromeMid : BA.chrome); set(x1 + 1 + i, y, i === len - 1 ? BA.chromeMid : BA.chrome) }
  }
  // The trim line that parts the turquoise from the ivory below.
  for (let x = 0; x < pw; x += 1) set(x, ph - 1, BA.chromeMid)
  const at = (f: number) => Math.round(S0 + f * (S1 - S0))
  // Numbers every 20 over the strip, ticks every 10.
  for (let n = 0; n <= 100; n += 20) {
    const s = String(n)
    const wide = s.length * 4 - 1
    const left = at(n / 100) - Math.floor(wide / 2)
    ;[...s].forEach((ch, i) => FONT[ch]!.forEach((line, gy) => [...line].forEach((c, gx) => { if (c === '#') set(left + i * 4 + gx, 5 + gy, BA.numeral) })))
  }
  for (let n = 0; n <= 10; n += 1) set(at(n / 10), 10, n % 2 === 0 ? BA.numeral : BA.tick)
  const fill = clamp(percent)
  for (let x = S0; x <= S1; x += 1) {
    const f = (x - S0) / (S1 - S0)
    const lit = fill >= 0 && fill > 0 && f <= fill + 1e-9
    for (let y = BAND_TOP; y <= BAND_BOT; y += 1) set(x, y, lit ? bandPx(fill) : BA.track)
  }
  if (fill > 0) for (let y = BAND_TOP - 1; y <= BAND_BOT; y += 1) set(at(fill), y, 0xfff6dc)
  if (warn) {
    const m = Math.round(cx)
    for (let y = 0; y <= 2; y += 1) for (let x = m - 3; x <= m + 2; x += 1) set(x, y, y === 0 && (x === m - 3 || x === m + 2) ? BA.paint : BA.red)
  }
  return encode(px, pw, ph)
}

export const GW = 14
export const GROWS = 7

// A small round gauge, like the clock and fuel gauge set into the lower
// dash: a chrome ring shaded from the top left, a dark face, a lit arc that
// sweeps 270 degrees and an ivory needle. A warned window lights a red lamp
// in the gap at the bottom.
export function roundCells(percent: number | undefined, warn = false): string {
  const pw = GW
  const ph = GROWS * 2
  const px = new Uint32Array(pw * ph).fill(BA.ivory)
  const c = (pw - 1) / 2
  const R = pw / 2
  const a0 = Math.PI * 1.25
  const span = Math.PI * 1.5
  const fill = clamp(percent)
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - c
      const dy = c - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.2) continue
      if (r > R - 1.3) { px[y * pw + x] = dx + dy > 2 ? BA.chrome : dx + dy < -2 ? BA.chromeDark : BA.chromeMid; continue }
      px[y * pw + x] = BA.face
      if (r > R - 3.2) {
        let ang = a0 - Math.atan2(dy, dx)
        while (ang < 0) ang += 2 * Math.PI
        const f = ang / span
        if (f <= 1) px[y * pw + x] = fill > 0 && f <= fill ? bandPx(fill) : BA.track
      }
    }
  }
  if (fill >= 0) {
    const t = a0 - fill * span
    for (let r = 0; r < R - 2.6; r += 0.3) px[Math.round(c - r * Math.sin(t)) * pw + Math.round(c + r * Math.cos(t))] = BA.needle
  }
  if (warn) for (let y = ph - 4; y <= ph - 3; y += 1) for (let x = Math.floor(c) - 1; x <= Math.ceil(c) + 1; x += 1) px[y * pw + x] = BA.red
  return encode(px, pw, ph)
}

// Chrome ribbing: vertical grooves along the lower dash.
export const RIBW = 22
export function ribsCells(w = RIBW): string {
  const px = new Uint32Array(w * 2).fill(PX.none)
  for (let x = 0; x < w; x += 1) { px[x] = x % 2 === 0 ? BA.chrome : BA.chromeDark; px[w + x] = x % 2 === 0 ? BA.chromeMid : BA.chromeDark }
  return encode(px, w, 2)
}

export const theme: ThemeDef = {
  id: 'fifties-chrome',
  category: 'vehicles',
  gauges: (main, second, third) => [
    { ...main, w: RW, rows: RROWS, cells: ribbonCells },
    { ...second, w: GW, rows: GROWS, cells: roundCells },
    { ...third, w: GW, rows: GROWS, cells: roundCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    const pct = (d: Dial) => <Text color={d.limit ? inkFor(d.limit.percent) : TX.soft} bold>{reading(d)}</Text>
    // A window's lines: percent, label, reset, and the warning in inverse red.
    const lines = (d: Dial, align: 'flex-start' | 'flex-end' | 'center', w: number) => (
      <Box flexDirection="column" width={w} flexShrink={0} alignItems={align} paddingX={1}>
        {pct(d)}
        <Text color={TX.ink} bold wrap="truncate-end">{d.label}</Text>
        <Text color={TX.soft} wrap="truncate-end">{line(reset(d))}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    // Keys by slot, not label: two slots may show the same source.
    const slot = (d: Dial) => (d === main ? 'main' : d === second ? 'second' : 'third')
    const gauge = (d: Dial) => <Raster key={`dial-${slot(d)}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
    const side = (RW - 2 - 2 * GW - RIBW) / 2
    return (
      <Box flexDirection="column" width={RW} backgroundColor={TX.ivory} alignItems="flex-start">
        {gauge(main)}
        <Box flexDirection="row" width={RW} paddingX={1} paddingTop={1}>
          {gauge(second)}
          {lines(second, 'flex-start', side)}
          <Box flexDirection="column" width={RIBW} flexShrink={0} alignItems="center">
            {lines(main, 'center', RIBW)}
            <Raster key="ribs" columns={RIBW} rows={1} cells={ribsCells()} />
          </Box>
          {lines(third, 'flex-end', side)}
          {gauge(third)}
        </Box>
      </Box>
    )
  },
}

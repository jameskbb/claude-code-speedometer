// The hexagon-tft cluster, after a modern supercar's all-digital TFT: on a
// black screen, one big round rev display in the middle with a lit arc
// sweeping clockwise round it and the digital readout in a hexagon inside,
// slim segmented arcs bracketing it either side, readouts framed as stretched
// hexagons, and the drive-mode row under it. The arc takes the drive
// mode's colour: green, then yellow, then orange as the window fills.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const HX = {
  bg: '#000000', screen: 0x000000, unlit: 0x262626, redline: 0x4a1010, ring: 0x3c3c3c, digit: 0xf4f4f4, dim: 0x5a5a5a,
  strada: 0x8be22b, sport: 0xffd400, corsa: 0xff7a00, red: 0xff2a2a, white: '#f4f4f4', grey: '#8a8a8a',
}
// The drive mode a percent puts the screen in: its name and colour.
export const mode = (p: number) => (p >= 80 ? { name: 'CORSA', px: HX.corsa } : p >= 50 ? { name: 'SPORT', px: HX.sport } : { name: 'STRADA', px: HX.strada })
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

// A 5 by 7 digit font for the readout in the middle of the rev display.
const FONT: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
}

function digits(px: Uint32Array, pw: number, text: string, cx: number, cy: number, color: number) {
  const w = text.length * 6 - 1
  const x0 = Math.round(cx - w / 2 + 0.5)
  const y0 = Math.round(cy - 3.5 + 0.5)
  ;[...text].forEach((ch, i) => {
    ;(FONT[ch] ?? FONT['-']!).forEach((line, gy) => [...line].forEach((on, gx) => {
      if (on === '#') px[(y0 + gy) * pw + x0 + i * 6 + gx] = color
    }))
  })
}

// A flat-topped hexagon outline round (cx, cy), rx to its side corners and
// ry to its top and bottom: the screen's frame for the readout.
function hexagon(px: Uint32Array, pw: number, cx: number, cy: number, rx: number, ry: number, color: number) {
  for (let t = 0; t < 6; t += 1) {
    const a = (Math.PI / 3) * t
    const b = (Math.PI / 3) * (t + 1)
    for (let k = 0; k <= 1; k += 0.02) {
      const x = cx + rx * ((1 - k) * Math.cos(a) + k * Math.cos(b))
      const y = cy - ((ry * 2) / Math.sqrt(3)) * ((1 - k) * Math.sin(a) + k * Math.sin(b))
      px[Math.round(y) * pw + Math.round(x)] = color
    }
  }
}

// A red hexagon six pixels wide, the warning pip.
function pip(px: Uint32Array, pw: number, x0: number, y0: number) {
  for (const [dy, from, to] of [[0, 1, 4], [1, 0, 5], [2, 0, 5], [3, 1, 4]] as const) for (let x = from; x <= to; x += 1) px[(y0 + dy) * pw + x0 + x] = HX.red
}

export const RW = 24

// The rev display: a lit band over 270 degrees from the lower left round to
// the lower right, the last fifth tinted red while unlit, the percent in
// digits inside a hexagon in the middle, and a red hexagon in the gap at the foot when warned.
export function revCells(percent: number | undefined, warn = false): string {
  const pw = RW
  const ph = RW
  const cx = (pw - 1) / 2
  const cy = (ph - 1) / 2
  const R = pw / 2 - 0.1
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const lit = fill >= 0 ? mode(fill * 100).px : HX.unlit
  const a0 = Math.PI * 1.25
  const span = Math.PI * 1.5
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      px[y * pw + x] = HX.screen
      if (r > R - 0.8) { px[y * pw + x] = HX.ring; continue }
      if (r < R - 3.4) continue
      let ang = a0 - Math.atan2(dy, dx)
      while (ang < 0) ang += 2 * Math.PI
      while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
      const frac = ang / span
      if (frac > 1) continue
      px[y * pw + x] = fill >= 0 && frac <= fill ? lit : frac > 0.8 ? HX.redline : HX.unlit
    }
  }
  const shown = percent === undefined ? '--' : String(Math.round(Math.max(0, Math.min(100, percent))))
  // Three digits fill the middle, so 100 goes without its frame.
  if (shown.length < 3) hexagon(px, pw, cx, cy - 0.5, 8.4, 5, HX.dim)
  digits(px, pw, shown, cx, cy, percent === undefined ? HX.dim : HX.digit)
  if (warn) {
    pip(px, pw, Math.floor(cx) - 2, ph - 4)
  }
  return encode(px, pw, ph)
}

// The side arcs: a slim segmented bracket either side of the rev display,
// concentric with it, as the screen's fuel and temperature arcs sit; eight
// segments filling upward, the top one tinted red, a red hexagon at the foot
// when warned. The left one bows out to the left, the right one to the right.
export const AW = 9
export const AR = 12
function sideArc(percent: number | undefined, warn: boolean, right: boolean): string {
  const pw = AW
  const ph = AR * 2
  // The rev display's centre, one column across the gap.
  const cx = right ? -1 - (RW - 1) / 2 : pw + 1 + (RW - 1) / 2
  const cy = (ph - 1) / 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const lit = fill >= 0 ? mode(fill * 100).px : HX.unlit
  const SEG = 8
  for (let y = 0; y < ph; y += 1) {
    // Segments by row, three pixel rows each with a dark one between, so
    // the cuts stay level as on the screen.
    const seg = (Math.floor((ph - 1 - y) / 3) + 1) / SEG
    if ((ph - 1 - y) % 3 === 2) continue
    for (let x = 0; x < pw; x += 1) {
      const dx = right ? x - cx : cx - x
      const r = Math.hypot(dx, cy - y)
      if (r < 16.6 || r > 19.4) continue
      px[y * pw + x] = fill >= 0 && seg <= fill + 0.5 / SEG ? lit : seg > 0.8 ? HX.redline : HX.unlit
    }
  }
  if (warn) {
    pip(px, pw, right ? pw - 6 : 0, ph - 4)
  }
  return encode(px, pw, ph)
}
export const leftArcCells = (percent: number | undefined, warn = false) => sideArc(percent, warn, false)
export const rightArcCells = (percent: number | undefined, warn = false) => sideArc(percent, warn, true)

export const theme: ThemeDef = {
  id: 'hexagon-tft',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: RW, rows: RW / 2, cells: revCells },
    { ...week, w: AW, rows: AR, cells: leftArcCells },
    { ...model, w: AW, rows: AR, cells: rightArcCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const tone = (d: Dial) => (d.limit ? hex(mode(d.limit.percent).px) : HX.grey)
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const warning = (d: Dial) => (warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>)
    const W = 19
    // A readout in a stretched hexagon, the screen's own frame shape.
    const cell = (color: string, label: string, value: string) => [
      <Text color={color}>{` ╱${'─'.repeat(W - 4)}╲ `}</Text>,
      <Text wrap="truncate-end"><Text color={color}>{'❮ '}</Text><Text color={HX.grey}>{label.padEnd(7)}</Text><Text color={HX.white} bold>{value.slice(0, W - 11).padEnd(W - 11)}</Text><Text color={color}>{' ❯'}</Text></Text>,
      <Text color={color}>{` ╲${'─'.repeat(W - 4)}╱ `}</Text>,
    ]
    // A side page: the window's reading, then two framed readouts.
    const side = (d: Dial, right: boolean, info: [string, string][]) => (
      <Box flexDirection="column" width={W} flexShrink={0} alignItems={right ? 'flex-end' : 'flex-start'}>
        <Text color={tone(d)} bold>{pct(d)}</Text>
        <Text color={HX.white} wrap="truncate-end">{d.label}</Text>
        <Text color={HX.grey} wrap="truncate-end">{reset(d)}</Text>
        {warning(d)}
        <Text> </Text>
        {info.flatMap(([k, v]) => cell('#3c3c3c', k, v))}
      </Box>
    )
    const arc = (d: Dial) => (
      <Box flexDirection="column" width={AW} flexShrink={0}>
        <Raster key={`dial-${d.label}`} columns={AW} rows={AR} cells={d.cells(d.limit?.percent, warned(d))} />
      </Box>
    )
    const now = five.limit ? mode(five.limit.percent).name : ''
    const tokens = context.tokens !== undefined ? ` ${Math.round(context.tokens / 1000)}k` : ''
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1} paddingX={1} backgroundColor={HX.bg} alignItems="flex-start">
          {side(week, false, [['CTX', context.percent === undefined ? '––%' : `${context.percent}%${tokens}`], ['COST', context.usd !== undefined ? `$${context.usd.toFixed(2)}` : '–']])}
          {arc(week)}
          <Box flexDirection="column" width={RW} flexShrink={0} alignItems="center">
            <Raster key={`dial-${five.label}`} columns={RW} rows={RW / 2} cells={five.cells(five.limit?.percent, warned(five))} />
            <Text wrap="truncate-end"><Text color={HX.white}>{five.label}</Text><Text color={tone(five)} bold>{` ${pct(five)}`}</Text></Text>
            <Text color={HX.grey} wrap="truncate-end">{reset(five)}</Text>
            {warning(five)}
            {/* The drive-mode row: the 5-hour window picks the lit one. */}
            <Box flexDirection="row" columnGap={1}>
              {['STRADA', 'SPORT', 'CORSA'].map((m, i) => (
                <Text color={m === now ? hex(mode([0, 50, 80][i]!).px) : HX.grey} bold={m === now} inverse={m === now}>{m === now ? m : m.toLowerCase()}</Text>
              ))}
            </Box>
          </Box>
          {arc(model)}
          {side(model, true, [['TOOLS', `${turn.tools}`], ['AGENTS', `${running}`]])}
        </Box>
      </Box>
    )
  },
}

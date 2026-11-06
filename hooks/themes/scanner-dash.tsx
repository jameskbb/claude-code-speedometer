// The scanner-dash cluster, after a talking car's dash from 1980s science
// fiction: a black panel with a red scanner light sweeping across the top,
// the red voice display in the middle (three columns of bars that grow out
// from the centre line), and a bank of small lit buttons, a segmented
// readout and an LED bar graph either side.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// The pixels: the voice and scanner reds, the lit button colours and their
// unlit shades, and the white lamp a warned window flashes.
const KR = {
  red: 0xff1a12, hot: 0xffc8b8, glow: 0xb01008, ember: 0x5a0804, dark: 0x2a0503,
  amber: 0xffa800, amberOff: 0x3a2600, green: 0x2cff4a, greenOff: 0x0c3a14, redOff: 0x3a0806,
  lamp: 0xffffff, dash: 0x7a7a7a, ghostGreen: 0x061a0a, ghostAmber: 0x1c1200, ghostRed: 0x1e0403,
}
// The text colours.
const TX = { panel: '#050505', red: '#ff2a1a', amber: '#ffa800', green: '#2cff4a', white: '#f2f2f2', grey: '#8a8a8a', dim: '#4a4a4a' }

// The voice display, a side bank, and the scanner across both.
export const VW = 30
export const BW = 25
export const ROWS = 11
export const SCW = 2 * BW + VW + 4
// Bars each way from the centre line: the middle column and the outer two.
export const MID_BARS = 5
export const SIDE_BARS = 4

const blank = (pw: number, ph: number) => new Uint32Array(pw * ph).fill(PX.none)
const rect = (px: Uint32Array, pw: number, x0: number, y0: number, w: number, hh: number, c: number) => {
  for (let y = y0; y < y0 + hh; y += 1) for (let x = x0; x < x0 + w; x += 1) px[y * pw + x] = c
}

// The voice display: three columns of one-pixel bars two pixels apart,
// lit outward from the centre pair as the 5-hour window fills. The middle
// column reaches further than the outer two. Unlit bars glow faintly; a
// warned window flashes white lamps either side.
export function voiceCells(percent: number | undefined, warn = false): string {
  const pw = VW
  const ph = ROWS * 2
  const px = blank(pw, ph)
  const f = clamp(percent)
  const top = ph / 2 - 1
  const cols: [number, number][] = [[4, SIDE_BARS], [12, MID_BARS], [20, SIDE_BARS]]
  for (const [x0, n] of cols) {
    const lit = f < 0 ? -1 : Math.round(f * n)
    for (let k = 0; k <= n; k += 1) {
      const c = lit < 0 ? KR.dark : k <= lit ? KR.red : KR.dark
      // The centre pair is one bar; each step out is a bar above and one below.
      if (k === 0) { rect(px, pw, x0, top, 6, 2, f < 0 ? KR.dark : KR.red); continue }
      rect(px, pw, x0, top - 2 * k, 6, 1, c)
      rect(px, pw, x0, top + 1 + 2 * k, 6, 1, c)
    }
  }
  if (warn) for (const x of [0, pw - 2]) rect(px, pw, x, top - 2, 2, 6, KR.lamp)
  return encode(px, pw, ph)
}

// A 5 by 7 seven-segment digit: a, b, c, d, e, f, g as in the usual order.
const SEGS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg',
  '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g',
}
function digit(px: Uint32Array, pw: number, x0: number, y0: number, ch: string, on: number, off: number) {
  const lit = SEGS[ch] ?? ''
  const seg = (s: string, pts: [number, number][]) => { for (const [x, y] of pts) px[(y0 + y) * pw + x0 + x] = lit.includes(s) ? on : off }
  seg('a', [[1, 0], [2, 0], [3, 0]])
  seg('b', [[4, 1], [4, 2]])
  seg('c', [[4, 4], [4, 5]])
  seg('d', [[1, 6], [2, 6], [3, 6]])
  seg('e', [[0, 4], [0, 5]])
  seg('f', [[0, 1], [0, 2]])
  seg('g', [[1, 3], [2, 3], [3, 3]])
}

// The bar graph's colour at a fraction along it: green, amber from half, red from 80%.
const ledOn = (t: number) => (t >= 0.8 ? KR.red : t >= 0.5 ? KR.amber : KR.green)
const ledOff = (t: number) => (t >= 0.8 ? KR.redOff : t >= 0.5 ? KR.amberOff : KR.greenOff)
// Unlit readout segments, fainter than an unlit LED so the digits read.
const ghost = (t: number) => (t >= 0.8 ? KR.ghostRed : t >= 0.5 ? KR.ghostAmber : KR.ghostGreen)
const BUTTONS = [KR.amber, KR.green, KR.red, KR.amber, KR.amber, KR.green]
const BUTTONS_OFF = [KR.amberOff, KR.greenOff, KR.redOff, KR.amberOff, KR.amberOff, KR.greenOff]
export const SEGMENTS = 8

// A side bank: two rows of six square buttons (the top row always lit, the
// second lit one per count, for tool calls or agents), the window's percent
// on a three-digit segment readout, and an eight-segment LED bar graph. A
// warned window lights a white lamp beside the readout.
export function bankCells(percent: number | undefined, warn = false, count = 0): string {
  const pw = BW
  const ph = ROWS * 2
  const px = blank(pw, ph)
  for (let i = 0; i < 6; i += 1) {
    rect(px, pw, 1 + i * 4, 0, 3, 2, BUTTONS[i]!)
    rect(px, pw, 1 + i * 4, 3, 3, 2, i < count ? BUTTONS[(i + 3) % 6]! : BUTTONS_OFF[(i + 3) % 6]!)
  }
  const f = clamp(percent)
  const text = f < 0 ? '---' : String(Math.round(f * 100)).padStart(3, ' ')
  const on = f < 0 ? KR.dash : ledOn(f)
  const off = f < 0 ? PX.none : ghost(f)
  for (let i = 0; i < 3; i += 1) digit(px, pw, 2 + i * 6, 8, text[i]!, on, off)
  if (warn) rect(px, pw, 21, 8, 3, 7, KR.lamp)
  for (let s = 0; s < SEGMENTS; s += 1) {
    const t = (s + 0.5) / SEGMENTS
    const lit = f >= 0 && s < Math.round(f * SEGMENTS)
    rect(px, pw, 1 + s * 3, 18, 2, 3, lit ? ledOn(t) : ledOff(t))
  }
  return encode(px, pw, ph)
}

// The scanner: a strip of red cells across the top half of one row, one
// bright eye with a fading trail behind it. The eye sits at the context
// window's fill; with no reading it rests dark.
export function scannerCells(percent: number | undefined, w = SCW): string {
  const pw = w
  const ph = 2
  const px = blank(pw, ph)
  const n = Math.floor(w / 3)
  const f = clamp(percent)
  const eye = f < 0 ? -1 : Math.round(f * (n - 1))
  const trail = [KR.red, KR.glow, KR.ember]
  for (let i = 0; i < n; i += 1) {
    const back = eye - i
    const c = eye < 0 ? KR.dark : back === 0 ? KR.hot : back > 0 && back <= 3 ? trail[back - 1]! : KR.dark
    rect(px, pw, i * 3, 0, back === 0 ? 3 : 2, 1, c)
  }
  return encode(px, pw, ph)
}

// The mode buttons under the voice display, lit by how full the 5-hour window is.
const MODES: [string, string][] = [['STANDBY', TX.green], ['CRUISE', TX.amber], ['ALERT', TX.red]]

export const theme: ThemeDef = {
  id: 'scanner-dash',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: VW, rows: ROWS, cells: voiceCells },
    { ...week, w: BW, rows: ROWS, cells: bankCells },
    { ...model, w: BW, rows: ROWS, cells: bankCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const tone = (d: Dial) => (!d.limit ? TX.dim : d.limit.percent >= 80 ? TX.red : d.limit.percent >= 50 ? TX.amber : TX.green)
    // A window's lines under its raster: percent and name, reset, then the warning.
    const lines = (d: Dial, w: number) => (
      <Box flexDirection="column" width={w} flexShrink={0} alignItems="center">
        <Text wrap="truncate-end"><Text color={tone(d)} bold>{pct(d)}</Text><Text color={TX.white}>{` ${d.label}`}</Text></Text>
        <Text color={TX.grey} wrap="truncate-end">{reset(d) || ' '}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    const p = five.limit?.percent
    const mode = p === undefined ? -1 : p >= 80 ? 2 : p >= 50 ? 1 : 0
    const ctx = context.percent === undefined ? '––%' : `${context.percent}%`
    const cost = context.usd === undefined ? '–' : `$${context.usd.toFixed(2)}`
    return (
      <Box flexDirection="column" backgroundColor={TX.panel} paddingX={1}>
        <Raster key="scanner" columns={SCW} rows={1} cells={scannerCells(context.percent)} />
        <Box flexDirection="row" columnGap={2}>
          <Box flexDirection="column" width={BW} flexShrink={0}>
            <Raster key={`dial-${week.label}`} columns={BW} rows={ROWS} cells={bankCells(week.limit?.percent, warned(week), turn.tools)} />
            {lines(week, BW)}
          </Box>
          <Box flexDirection="column" width={VW} flexShrink={0}>
            <Raster key={`dial-${five.label}`} columns={VW} rows={ROWS} cells={five.cells(p, warned(five))} />
            {lines(five, VW)}
          </Box>
          <Box flexDirection="column" width={BW} flexShrink={0}>
            <Raster key={`dial-${model.label}`} columns={BW} rows={ROWS} cells={bankCells(model.limit?.percent, warned(model), running)} />
            {lines(model, BW)}
          </Box>
        </Box>
        <Box flexDirection="row" width={SCW} justifyContent="space-between">
          <Text wrap="truncate-end"><Text color={TX.grey}>CTX </Text><Text color={TX.amber} bold>{ctx}</Text><Text color={TX.grey}> COST </Text><Text color={TX.amber} bold>{cost}</Text></Text>
          <Text wrap="truncate-end">
            {MODES.map(([name, color], i) => <Text color={i === mode ? TX.panel : TX.dim} backgroundColor={i === mode ? color : undefined} bold={i === mode}>{` ${name} `}</Text>)}
          </Text>
          <Text wrap="truncate-end"><Text color={TX.grey}>TOOLS </Text><Text color={TX.amber} bold>{`${turn.tools}`}</Text><Text color={TX.grey}> AGENTS </Text><Text color={TX.amber} bold>{`${running}`}</Text></Text>
        </Box>
      </Box>
    )
  },
}

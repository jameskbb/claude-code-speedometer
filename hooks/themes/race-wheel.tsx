// The race-wheel cluster, after a modern single-seater racing steering wheel seen face on:
// a carbon-fibre body between two rubber grips, a row of shift lights across
// the top that fills green, then red, then blue, a small LCD in the middle
// with big gear-style digits, and coloured rotaries and buttons around it.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const FW = {
  carbon: 0x1a1a1d, weave: 0x1f1f23, housing: 0x070708, rubber: 0x3a3a3e, ridge: 0x2a2a2e, sheen: 0x58585e,
  bezel: 0x4a4a50, screen: 0x040406, digit: 0xf4f4f4, unread: 0x4a4a4a,
  dot: 0x45454a, dotRed: 0x4a1616, lit: 0xf4f4f4, red: 0xff2a2a, lampOff: 0x261010, pointer: 0xf4f4f4,
  blue: 0x2b6cff, orange: 0xff7a1a, green: 0x2fd16a, yellow: 0xffd23f, purple: 0xa35cff, white: 0xe8e8e8, cyan: 0x3fd8ff,
}
// The text colours, on the carbon.
const TX = { carbon: '#1a1a1d', white: '#f4f4f4', grey: '#8a8a90', green: '#2fd16a', yellow: '#ffd23f', purple: '#a35cff' }

// The shift lights: five green, five red, five blue, and how each looks unlit.
export const LEDS = 15
const STAGES: [number, number][] = [[0x2fe060, 0x0e2a16], [0xff2a2a, 0x2e0e0e], [0x2f6bff, 0x0e1630]]

// A 3 by 5 font for the LCD's digits, drawn at twice the size.
const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '..#', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], '-': ['...', '...', '###', '...', '...'],
}

const set = (px: Uint32Array, pw: number, x: number, y: number, c: number) => {
  if (x >= 0 && x < pw && y >= 0 && y * pw + x < px.length) px[y * pw + x] = c
}

// The 5-hour window: the shift-light strip in its black housing, and under
// it the LCD with the percent in big digits. A warned window rings the LCD
// in red. Drawn from x = ox, 48 pixels wide and 18 tall.
export const LW = 48
function paintFive(px: Uint32Array, pw: number, ox: number, fill: number, warn: boolean, percent: number | undefined) {
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < LW; x += 1) set(px, pw, ox + x, y, FW.housing)
  const on = fill < 0 ? 0 : Math.round(fill * LEDS)
  for (let i = 0; i < LEDS; i += 1) {
    const [lit, off] = STAGES[Math.floor(i / 5)]!
    for (const y of [1, 2]) for (const dx of [0, 1]) set(px, pw, ox + 2 + i * 3 + dx, y, i < on ? lit : off)
  }
  // The LCD, 22 by 14 with a one-pixel bezel.
  const lx = ox + 13
  for (let y = 4; y < 18; y += 1) {
    for (let x = lx; x < lx + 22; x += 1) set(px, pw, x, y, y === 4 || y === 17 || x === lx || x === lx + 21 ? (warn ? FW.red : FW.bezel) : FW.screen)
  }
  const text = percent === undefined ? '--' : String(Math.min(999, Math.max(0, Math.round(percent))))
  const gap = text.length > 2 ? 1 : 2
  const width = text.length * 6 + (text.length - 1) * gap
  let x0 = lx + 1 + Math.floor((20 - width) / 2)
  for (const ch of text) {
    FONT[ch]!.forEach((line, gy) => [...line].forEach((c, gx) => {
      if (c !== '#') return
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(px, pw, x0 + gx * 2 + dx!, 6 + gy * 2 + dy!, percent === undefined ? FW.unread : FW.digit)
    }))
    x0 += 6 + gap
  }
}

// A rotary 14 pixels across centred (cx, cy): eleven position dots round a
// 270 degree sweep, lit up to the reading (the last two red), around a
// coloured cap with a white pointer. A warned window rims the cap in red.
export const RW = 14
const A0 = Math.PI * 1.25
const A1 = Math.PI * -0.25
function paintRotary(px: Uint32Array, pw: number, cx: number, cy: number, fill: number, warn: boolean, cap: number) {
  for (let y = Math.floor(cy - 7); y <= Math.ceil(cy + 7); y += 1) {
    for (let x = Math.floor(cx - 7); x <= Math.ceil(cx + 7); x += 1) {
      const r = Math.hypot(x - cx, y - cy)
      if (r <= 3.6) set(px, pw, x, y, cap)
      else if (r <= 4.7) set(px, pw, x, y, warn ? FW.red : 0x0c0c0e)
    }
  }
  for (let i = 0; i <= 10; i += 1) {
    const t = A0 - (i / 10) * (A0 - A1)
    const lit = fill >= 0 && i / 10 <= fill + 1e-9
    set(px, pw, Math.round(cx + 6 * Math.cos(t)), Math.round(cy - 6 * Math.sin(t)), i >= 8 ? (lit ? FW.red : FW.dotRed) : lit ? FW.lit : FW.dot)
  }
  if (fill >= 0) {
    const t = A0 - fill * (A0 - A1)
    for (let r = 0; r <= 3.6; r += 0.4) set(px, pw, Math.round(cx + r * Math.cos(t)), Math.round(cy - r * Math.sin(t)), FW.pointer)
  }
}

// A round push button, 2 by 2 with a dark rim cut into its corners.
function paintButton(px: Uint32Array, pw: number, x: number, y: number, c: number) {
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(px, pw, x + dx!, y + dy!, c)
}

// A faint diagonal twill, as carbon fibre shows under lacquer.
const carbon = (x: number, y: number) => (((x + y) >> 1) & 1 ? FW.weave : FW.carbon)

// The LCD and shift lights alone, for the 5-hour dial.
export const lcdCells = (percent: number | undefined, warn = false) => {
  const px = new Uint32Array(LW * 18).fill(PX.none)
  paintFive(px, LW, 0, clamp(percent), warn, percent)
  return encode(px, LW, 18)
}
// One rotary alone, in the weekly or model colour.
export const rotaryCells = (cap: number) => (percent: number | undefined, warn = false) => {
  const px = new Uint32Array(RW * RW).fill(PX.none)
  paintRotary(px, RW, 6.5, 6.5, clamp(percent), warn, cap)
  return encode(px, RW, RW)
}

// The top of the wheel's body, one raster: the housing across the top with
// a pair of flag lights at each end (red for a warned weekly or model
// window), the shift lights and LCD in the middle, a rotary either side and
// small buttons between. Text rows sit under it on the same carbon.
export const MW = 62
export const MR = 9
export type Readings = { five?: number; week?: number; model?: number; warn: [boolean, boolean, boolean] }
export function wheelCells(r: Readings): string {
  const pw = MW
  const ph = MR * 2
  const px = new Uint32Array(pw * ph)
  for (let y = 0; y < ph; y += 1) for (let x = 0; x < pw; x += 1) px[y * pw + x] = carbon(x, y)
  for (let y = 0; y < 4; y += 1) for (let x = 1; x < pw - 1; x += 1) px[y * pw + x] = FW.housing
  for (const [x, warn] of [[2, r.warn[1]], [5, r.warn[1]], [55, r.warn[2]], [58, r.warn[2]]] as const) {
    for (const y of [1, 2]) for (const dx of [0, 1]) px[y * pw + x + dx] = warn ? FW.red : FW.lampOff
  }
  paintFive(px, pw, 7, clamp(r.five), r.warn[0], r.five)
  paintRotary(px, pw, 9.5, 10.5, clamp(r.week), r.warn[1], FW.blue)
  paintRotary(px, pw, 51.5, 10.5, clamp(r.model), r.warn[2], FW.orange)
  // Buttons by the LCD: context and white on the left, tools and agents on the right.
  paintButton(px, pw, 17, 6, FW.green)
  paintButton(px, pw, 17, 13, FW.white)
  paintButton(px, pw, 43, 6, FW.yellow)
  paintButton(px, pw, 43, 13, FW.purple)
  return encode(px, pw, ph)
}

// A grip, 11 wide and GR rows tall, a row longer than the body: a ridged
// rubber handle bulging on the outside, rounded at both ends, joined to the
// body by carbon with a thumb button.
export const GW = 11
export const GR = MR + 6
export function gripCells(right: boolean): string {
  const pw = GW
  const ph = GR * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const inside = (x: number, y: number, x0: number, x1: number, y0: number, y1: number, rad: number) => {
    const qx = Math.max(x0 + rad - x, 0, x - (x1 - rad))
    const qy = Math.max(y0 + rad - y, 0, y - (y1 - rad))
    return Math.hypot(qx, qy) <= rad + 0.2
  }
  for (let y = 0; y < ph; y += 1) {
    for (let k = 0; k < pw; k += 1) {
      const x = right ? pw - 1 - k : k
      let c: number = PX.none
      if (inside(k, y, 4, 10, 0, ph - 3, 2.5)) c = carbon(x, y)
      // The outer edge swells toward the middle, as a hand grip does.
      const outer = 2.2 * (1 - Math.sin((Math.PI * (y + 0.5)) / ph))
      if (k >= Math.floor(outer) && inside(k, y, 0, 6, 1, ph - 1, 3)) c = k === Math.floor(outer) + 1 ? FW.sheen : y % 2 ? FW.ridge : FW.rubber
      px[y * pw + x] = c
    }
  }
  // Thumb buttons on the carbon above the grip.
  for (const y of [3, 4]) for (const k of [7, 8]) px[y * pw + (right ? pw - 1 - k : k)] = right ? FW.cyan : FW.white
  return encode(px, pw, ph)
}

export const theme: ThemeDef = {
  id: 'race-wheel',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: LW, rows: 9, cells: lcdCells },
    { ...week, w: RW, rows: RW / 2, cells: rotaryCells(FW.blue) },
    { ...model, w: RW, rows: RW / 2, cells: rotaryCells(FW.orange) },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const tone = (d: Dial) => (d.limit ? (d.limit.percent >= 80 ? 'error' : d.limit.percent >= 50 ? 'warning' : 'success') : TX.grey)
    // A window's lines under its rotary or the LCD, then one button's readout.
    const under = (d: Dial, w: number, dot: string, key: string, value: string) => (
      <Box flexDirection="column" width={w} flexShrink={0} alignItems="center">
        <Text color={tone(d)} bold>{pct(d)}</Text>
        <Text color={TX.white} wrap="truncate-end">{d.label}</Text>
        <Text color={TX.grey} wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
        <Text wrap="truncate-end"><Text color={dot}>{'● '}</Text><Text color={TX.grey}>{`${key} `}</Text><Text color={TX.white} bold>{value}</Text></Text>
      </Box>
    )
    const cells = wheelCells({ five: five.limit?.percent, week: week.limit?.percent, model: model.limit?.percent, warn: [warned(five), warned(week), warned(model)] })
    const ctx = context.percent === undefined ? '––%' : `${context.percent}%${context.usd !== undefined ? ` $${context.usd.toFixed(2)}` : ''}`
    return (
      <Box flexDirection="row" alignItems="flex-start">
        <Raster key="grip-left" columns={GW} rows={GR} cells={gripCells(false)} />
        <Box flexDirection="column" width={MW} flexShrink={0} backgroundColor={TX.carbon}>
          <Raster key="wheel" columns={MW} rows={MR} cells={cells} />
          <Box flexDirection="row">
            {under(week, 20, TX.green, 'CTX', ctx)}
            {under(five, 22, TX.yellow, 'TOOLS', `${turn.tools}`)}
            {under(model, 20, TX.purple, 'AGENTS', `${running}`)}
          </Box>
        </Box>
        <Raster key="grip-right" columns={GW} rows={GR} cells={gripCells(true)} />
      </Box>
    )
  },
}

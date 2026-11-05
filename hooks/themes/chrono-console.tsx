// The chrono-console cluster, after a 1980s science-fiction time-travel
// console in a stainless steel car: three stacked rows of chunky
// segment displays in a brushed-metal housing, red on top, green in the
// middle, amber at the bottom. Each row has small labelled windows and a
// label plate under it. The first window holds the percent used; the rest
// read the moment the window resets: month, day, AM or PM, hour and minute.
import { bar, clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// A row's segment colours: lit, and the dim ghost of an unlit segment.
export type Tube = { lit: number; ghost: number; text: string }
export const TUBES: [Tube, Tube, Tube] = [
  { lit: 0xff3a24, ghost: 0x3c0d08, text: '#ff5a44' },
  { lit: 0x3dff6a, ghost: 0x0c3016, text: '#4dff7a' },
  { lit: 0xffb21a, ghost: 0x3a2804, text: '#ffbe3a' },
]

// The housing: two shades of brushed steel, the black of a window, and the
// red mark a warned row wears round its percent window.
const MT = { steel: 0x8b9097, brush: 0x868b92, edge: 0x4a4e54, window: 0x050505, warn: 0xff2020 }
const TX = { steel: '#8b9097', engraved: '#16181b', plate: '#0b0b0b', plateText: '#f2f2f2', dim: '#2a2d31' }

// Glyphs are 4 by 5. A digit is seven segments: a top, b upper right, c lower
// right, d bottom, e lower left, f upper left, g middle.
const SEG: Record<string, [number, number][]> = {
  a: [[0, 0], [1, 0], [2, 0], [3, 0]], b: [[3, 0], [3, 1], [3, 2]], c: [[3, 2], [3, 3], [3, 4]],
  d: [[0, 4], [1, 4], [2, 4], [3, 4]], e: [[0, 2], [0, 3], [0, 4]], f: [[0, 0], [0, 1], [0, 2]], g: [[0, 2], [1, 2], [2, 2], [3, 2]],
}
const DIGIT: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
}
// The month letters, as a block font on the same grid; they show no ghost.
const LETTER: Record<string, string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '###.'], C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'], E: ['####', '#...', '###.', '#...', '####'], F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'], J: ['..##', '...#', '...#', '#..#', '.##.'], L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#..#', '####', '####', '#..#', '#..#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'], R: ['###.', '#..#', '###.', '#.#.', '#..#'], S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['####', '.##.', '.##.', '.##.', '.##.'], U: ['#..#', '#..#', '#..#', '#..#', '.##.'], V: ['#..#', '#..#', '#..#', '.##.', '.##.'],
  Y: ['#..#', '#..#', '.##.', '.##.', '.##.'],
}
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const ghost8 = new Set(Object.values(SEG).flat().map(([x, y]) => `${x},${y}`))

function glyph(px: Uint32Array, pw: number, x0: number, y0: number, ch: string, tube: Tube) {
  const on = new Set<string>()
  if (ch in DIGIT) for (const s of DIGIT[ch]!) for (const [x, y] of SEG[s]!) on.add(`${x},${y}`)
  else LETTER[ch]?.forEach((line, y) => [...line].forEach((c, x) => { if (c === '#') on.add(`${x},${y}`) }))
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const k = `${x},${y}`
      if (on.has(k)) px[(y0 + y) * pw + x0 + x] = tube.lit
      else if (ch in DIGIT && ghost8.has(k)) px[(y0 + y) * pw + x0 + x] = tube.ghost
    }
  }
}

// The windows along a row: where each starts, how wide it is and the label
// engraved over it. A window for n glyphs is 5n + 1 wide.
export const RW = 84
export const RR = 3
export const WINDOWS = {
  used: { x: 1, w: 16, label: '% USED' },
  month: { x: 20, w: 16, label: 'MONTH' },
  day: { x: 38, w: 11, label: 'DAY' },
  ampm: { x: 51, w: 5, label: 'AM PM' },
  hour: { x: 58, w: 11, label: 'HOUR' },
  min: { x: 72, w: 11, label: 'MIN' },
}

// The reset moment as the row shows it, in local time; undefined with none.
export type Moment = { month: number; day: number; hour: number; minute: number }
export const moment = (iso: string | undefined): Moment | undefined => {
  const t = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(t)) return undefined
  const at = new Date(t)
  return { month: at.getMonth(), day: at.getDate(), hour: at.getHours(), minute: at.getMinutes() }
}

// One row's pixels: the steel strip, its black windows with the percent and
// the reset moment in segments, a colon, and the AM and PM lamps. A warned
// row rings its percent window in red.
export function rowCells(percent: number | undefined, warn = false, tube: Tube = TUBES[0], at?: Moment): string {
  const pw = RW
  const ph = RR * 2
  const px = new Uint32Array(pw * ph)
  for (let y = 0; y < ph; y += 1) px.fill(y % 2 ? MT.brush : MT.steel, y * pw, (y + 1) * pw)
  const box = (x0: number, w: number, color: number, y0 = 0, y1 = ph - 1) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x < x0 + w; x += 1) if (x >= 0 && x < pw) px[y * pw + x] = color
  }
  if (warn) box(WINDOWS.used.x - 1, WINDOWS.used.w + 2, MT.warn)
  for (const win of Object.values(WINDOWS)) box(win.x, win.w, MT.window)
  const text = (win: { x: number }, s: string) => [...s].forEach((c, i) => glyph(px, pw, win.x + 1 + i * 5, 1, c, tube))
  const fill = clamp(percent)
  text(WINDOWS.used, fill < 0 ? ' --' : String(Math.min(999, Math.max(0, Math.round(percent!)))).padStart(3, ' '))
  const two = (n: number | undefined) => (n === undefined ? '--' : String(n).padStart(2, '0'))
  text(WINDOWS.month, at ? MONTHS[at.month]! : '---')
  text(WINDOWS.day, two(at?.day))
  text(WINDOWS.hour, two(at ? (at.hour % 12 || 12) : undefined))
  text(WINDOWS.min, two(at?.minute))
  // The AM and PM lamps, two pixels square, the one lit that applies.
  const lamp = (x: number, lit: boolean) => box(x, 2, lit ? tube.lit : tube.ghost, 2, 3)
  lamp(WINDOWS.ampm.x, at !== undefined && at.hour < 12)
  lamp(WINDOWS.ampm.x + 3, at !== undefined && at.hour >= 12)
  // The colon between hour and minute, on the steel.
  const cx = WINDOWS.hour.x + WINDOWS.hour.w + 1
  px[2 * pw + cx] = tube.lit
  px[4 * pw + cx] = tube.lit
  return encode(px, pw, ph)
}

export const theme: ThemeDef = {
  id: 'chrono-console',
  category: 'vehicles',
  gauges: (five, week, model) => {
    const row = (d: Omit<Dial, 'w' | 'rows' | 'cells'>, tube: Tube): Dial => ({
      ...d, w: RW, rows: RR, cells: (p, warn) => rowCells(p, warn, tube, moment(d.limit?.resetsAt)),
    })
    return [row(five, TUBES[0]), row(week, TUBES[1]), row(model, TUBES[2])]
  },
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty }: ThemeCtx) => {
    // The engraved labels over the windows, each centred on its window.
    const heads = Object.values(WINDOWS).reduce((line, win) => {
      const at = win.x + Math.floor((win.w - win.label.length) / 2)
      return line.padEnd(at, ' ') + win.label
    }, '').padEnd(RW, ' ')
    const row = (d: Dial, tube: Tube) => {
      const p = d.limit?.percent
      return (
        <Box flexDirection="column" width={RW} flexShrink={0}>
          <Text color={TX.engraved} backgroundColor={TX.steel} bold wrap="truncate-end">{heads}</Text>
          <Raster key={`dial-${d.label}`} columns={RW} rows={RR} cells={d.cells(p, warned(d))} />
          <Box flexDirection="row" width={RW} backgroundColor={TX.steel}>
            <Box width={WINDOWS.month.x - 1} flexShrink={0} paddingLeft={1}>
              <Text wrap="truncate-end"><Text color={tube.text} backgroundColor={TX.plate}>{p === undefined ? '▱'.repeat(10) : bar(p, 10)}</Text><Text color={TX.engraved} bold>{p === undefined ? ' ––%' : ` ${p}%`}</Text></Text>
            </Box>
            <Box width={WINDOWS.ampm.x - WINDOWS.month.x} flexShrink={0} justifyContent="center">
              <Text color={TX.plateText} backgroundColor={TX.plate} bold wrap="truncate-end">{` ${d.label.toUpperCase()} `}</Text>
            </Box>
            <Box width={RW - WINDOWS.ampm.x + 1} flexShrink={0} paddingLeft={1}>
              <Text wrap="truncate-end">
                <Text color={TX.engraved} bold>{`${reset(d) || ' '} `}</Text>
                {warned(d) ? <Text color="error" bold inverse>{` ${empty(d)} `}</Text> : null}
              </Text>
            </Box>
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" backgroundColor={TX.steel} paddingX={1} rowGap={0}>
        {row(five, TUBES[0])}
        {row(week, TUBES[1])}
        {row(model, TUBES[2])}
      </Box>
    )
  },
}

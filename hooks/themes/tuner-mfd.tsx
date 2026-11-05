// The tuner-mfd cluster, after a late-1990s Japanese turbo coupe's centre multifunction
// display: a dark navy screen, a strip of page tabs across the top, a round
// segmented boost gauge with its reading in digits, and segmented bar graphs
// lit blue-white with an amber top end, a digital readout beside each.
import { clamp, encode, PX, seconds } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// The pixels: the screen's navy, unlit segments, lit blue-white with a
// brighter core, the amber top end, and the warning lamp.
const MF = {
  face: 0x0b1a3c, frame: 0x2a5296, dim: 0x1d3166, lit: 0x8cc4ff, core: 0xeaf6ff,
  amber: 0xffaa2a, amberDim: 0x4a3414, red: 0xff3b3b, redDim: 0x3a1424,
}
// The text colours.
const TX = { screen: '#06112a', white: '#e4f2ff', blue: '#8fbaf0', dim: '#4a6aa3', amber: '#ffaa2a' }

// Every scale's last fifth is amber.
const AMBER = 0.8
// The round gauge sweeps 270 degrees clockwise from lower left.
const A0 = Math.PI * 1.25
const SPAN = Math.PI * 1.5

const swept = (dx: number, dy: number) => {
  let ang = A0 - Math.atan2(dy, dx)
  while (ang < 0) ang += 2 * Math.PI
  while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
  return ang / SPAN
}

// A 3 by 5 font for the digits inside the gauge.
const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '..#', '..#', '..#'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], '-': ['...', '...', '###', '...', '...'],
}

// The round gauge, w pixels across: a thin blue bezel, a ring of segments
// that light from lower left, the reading in digits inside,
// and a lamp in the open bottom that glows red when the window is warned.
export function roundCells(percent: number | undefined, warn = false, w = 22): string {
  const pw = w
  const ph = w
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const c = (w - 1) / 2
  const R = w / 2 - 0.1
  const fill = clamp(percent)
  const segs = 20
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - c
      const dy = c - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      const i = y * pw + x
      if (r > R - 0.8) { px[i] = MF.frame; continue }
      px[i] = MF.face
      const f = swept(dx, dy)
      if (f > 1) continue
      if (r > R - 3.8 && r < R - 1.2) {
        const seg = Math.min(segs - 1, Math.floor(f * segs))
        // A thin gap between segments, so the ring reads as blocks.
        if (f * segs - seg > 0.78) continue
        const hot = (seg + 1) / segs > AMBER
        const on = fill >= 0 && (seg + 0.5) / segs <= fill
        px[i] = on ? (hot ? MF.amber : r > R - 2.8 && r < R - 1.9 ? MF.core : MF.lit) : hot ? MF.amberDim : MF.dim
      }
    }
  }
  // The reading in digits in the middle, white, amber in the top fifth.
  const text = fill < 0 ? '--' : String(Math.round(fill * 100))
  const tw = text.length * 4 - 1
  const x0 = Math.round(c - (tw - 1) / 2)
  const y0 = Math.round(c - 2.5)
  ;[...text].forEach((ch, k) => FONT[ch]!.forEach((line, gy) => [...line].forEach((on, gx) => {
    if (on === '#') px[(y0 + gy) * pw + x0 + k * 4 + gx] = fill < 0 ? MF.dim : fill > AMBER ? MF.amber : MF.core
  })))
  // The lamp in the gap at the bottom.
  const ly = Math.round(c + R * 0.7)
  for (let y = ly; y <= ly + 1; y += 1) for (let x = Math.floor(c) - 2; x <= Math.ceil(c) + 2; x += 1) px[y * pw + x] = warn ? MF.red : MF.redDim
  return encode(px, pw, ph)
}

// A bar graph w pixels across and two rows tall: one-pixel segments with a
// gap between, a bright core along the middle, the last fifth amber, and a
// red end lamp when the window is warned.
export const BROWS = 2
export function barCells(percent: number | undefined, warn = false, w = 30): string {
  const pw = w
  const ph = BROWS * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const segs = Math.floor((w - 2) / 2)
  for (let s = 0; s < segs; s += 1) {
    const hot = (s + 1) / segs > AMBER
    const on = fill >= 0 && (s + 0.5) / segs <= fill
    for (let y = 0; y < ph; y += 1) px[y * pw + s * 2] = on ? (hot ? MF.amber : y === 1 || y === 2 ? MF.core : MF.lit) : hot ? MF.amberDim : MF.dim
  }
  if (warn) for (let y = 0; y < ph; y += 1) px[y * pw + w - 1] = MF.red
  return encode(px, pw, ph)
}

// The 5-hour window is the boost gauge; the other two are bar graphs.
export const GW = 22
export const BARW = 30
// The readout columns beside the gauge and beside each bar.
const GRW = 19
const BRW = 13

export const theme: ThemeDef = {
  id: 'tuner-mfd',
  category: 'vehicles',
  gauges: (five, week, model) => [
    { ...five, w: GW, rows: GW / 2, cells: roundCells },
    { ...week, w: BARW, rows: BROWS, cells: barCells },
    { ...model, w: BARW, rows: BROWS, cells: barCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const t = (text: string, color: string, bold = false) => <Text color={color} bold={bold} wrap="truncate-end">{text}</Text>
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const alarm = (d: Dial) => (warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>)
    const pair = (k: string, v: string) => <Text wrap="truncate-end"><Text color={TX.amber} bold>{k.padEnd(7)}</Text><Text color={TX.white} bold>{v}</Text></Text>
    // A bar graph: its name and reset over the bar, the percent and the
    // window beside it, and the warning under it.
    const graph = (name: string, right: string, readout: string, sub: string, cells: string, key: string, warn?: unknown) => (
      <Box flexDirection="column" width={BARW + BRW} flexShrink={0}>
        <Box flexDirection="row" width={BARW} justifyContent="space-between">
          {t(name, TX.amber, true)}
          {t(right, TX.dim)}
        </Box>
        <Box flexDirection="row">
          <Raster key={key} columns={BARW} rows={BROWS} cells={cells} />
          <Box flexDirection="column" width={BRW} paddingLeft={1}>
            {t(readout, TX.white, true)}
            {t(sub, TX.blue)}
          </Box>
        </Box>
        {warn ?? null}
      </Box>
    )
    const win = (d: Dial, name: string) => graph(name, reset(d), pct(d), d.label, d.cells(d.limit?.percent, warned(d)), `dial-${d.label}`, alarm(d))
    const tab = (name: string, on: boolean) => (on
      ? <Text color={TX.screen} backgroundColor={TX.white} bold>{` ${name} `}</Text>
      : <Text color={TX.blue}>{` ${name} `}</Text>)
    const full = GW + GRW + 1 + BARW + BRW
    return (
      <Box flexDirection="column" backgroundColor={TX.screen} paddingX={1}>
        <Box flexDirection="row" width={full} justifyContent="space-between">
          <Text wrap="truncate-end">{tab('BOOST', true)}{tab('OIL', false)}{tab('INTAKE', false)}{tab('THROTTLE', false)}{tab('TIMER', false)}</Text>
          <Text wrap="truncate-end"><Text color={TX.dim}>LAP </Text><Text color={TX.white} bold>{turn.lastMs > 0 ? seconds(turn.lastMs) : '––'}</Text></Text>
        </Box>
        {t('─'.repeat(full), TX.dim)}
        <Box flexDirection="row" columnGap={1}>
          <Box flexDirection="row" width={GW + GRW} flexShrink={0}>
            <Raster key={`dial-${five.label}`} columns={GW} rows={five.rows} cells={five.cells(five.limit?.percent, warned(five))} />
            <Box flexDirection="column" width={GRW} paddingLeft={1}>
              {t('BOOST', TX.amber, true)}
              {t(pct(five), TX.white, true)}
              {t(five.label, TX.blue)}
              {t(reset(five) || ' ', TX.dim)}
              {alarm(five)}
              <Text> </Text>
              {pair('TOOLS', `${turn.tools}`)}
              {pair('AGENTS', `${running}`)}
            </Box>
          </Box>
          <Box flexDirection="column" width={BARW + BRW} flexShrink={0}>
            {win(week, 'OIL TEMP')}
            {win(model, 'INTAKE TEMP')}
            {graph('THROTTLE', context.tokens === undefined ? '' : `${Math.round(context.tokens / 1000)}k`, context.percent === undefined ? '––%' : `${context.percent}%`, 'context', barCells(context.percent, false, BARW), 'bar-throttle')}
          </Box>
        </Box>
      </Box>
    )
  },
}

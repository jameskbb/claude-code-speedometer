// The bars cluster: three wide progress bars stacked, one per gauge slot
// (main, second, third; each shows its configured source). Each
// is a thin half-block bar over a dim track, with faint ticks at 25, 50 and
// 75 and a dim red mark at 80, where red begins. The fill turns green,
// yellow, red along its length like the classic dials, and a warned bar ends
// in a red cap that drops below the line.
import { clamp, encode, PX, reading, zone, zonePx } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// Each bar is this many columns wide; its text line spans the same width.
export const BW = 86

const TICK = 0x464646
const NOTCH = 0x6a2c2a
// A tick on the fill: the zone colour a third darker.
const shade = (c: number) => [16, 8, 0].reduce((n, s) => n + (Math.round(((c >> s) & 0xff) * 2 / 3) << s), 0)

// A bar w columns wide and one row tall: the bar in the top half-row, the
// bottom one empty but for a warned bar's cap.
export function barCells(percent: number | undefined, warn = false, w = BW): string {
  const pw = w
  const ph = 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const at = (q: number) => Math.min(pw - 1, Math.max(0, Math.round(q * pw) - 1))
  let last = -1
  for (let x = 0; x < pw; x += 1) {
    const frac = (x + 0.5) / pw
    if (fill > 0 && frac <= fill + 0.5 / pw) { px[x] = zonePx(frac * 100); last = x } else px[x] = PX.track
  }
  for (const q of [0.25, 0.5, 0.75]) { const x = at(q); px[x] = px[x] === PX.track ? TICK : shade(px[x] ?? 0) }
  if (px[at(0.8)] === PX.track) px[at(0.8)] = NOTCH
  if (warn) {
    const x = Math.max(0, last)
    px[x] = PX.red
    px[pw + x] = PX.red
  }
  return encode(px, pw, ph)
}

export const theme: ThemeDef = {
  id: 'bars',
  category: 'classic',
  gauges: (main, second, third) => [
    { ...main, w: BW, rows: 1, cells: (p, warn) => barCells(p, warn) },
    { ...second, w: BW, rows: 1, cells: (p, warn) => barCells(p, warn) },
    { ...third, w: BW, rows: 1, cells: (p, warn) => barCells(p, warn) },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    const row = (d: Dial, i: number) => (
      <Box flexDirection="column" width={d.w} flexShrink={0}>
        <Box flexDirection="row" width={d.w} justifyContent="space-between">
          <Text wrap="truncate-end">
            <Text>{d.label}</Text>
            <Text dimColor>{reset(d) ? `  ${reset(d)}` : ''}</Text>
            {warned(d) ? <Text color="error" bold>{`  ${empty(d)}`}</Text> : ''}
          </Text>
          <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{reading(d)}</Text>
        </Box>
        <Raster key={`dial-${i}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
      </Box>
    )
    return (
      <Box flexDirection="column" rowGap={1}>
        {[main, second, third].map(row)}
      </Box>
    )
  },
}

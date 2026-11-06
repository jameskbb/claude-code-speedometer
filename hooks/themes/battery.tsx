// The battery cluster: three flat battery icons in a row, one per gauge slot
// (main, second, third; each shows its configured source). The charge is what
// the slot's reading has left, so a battery drains as its window (or the
// context window) fills. Its cells take the zone colour of the percent used,
// and a warned battery gets a red exclamation mark beside its terminal.
import { clamp, encode, PX, zone, zonePx } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// No reading: a dimmer shell and no charge.
const BT = { shell: 0xb4b4b4, dim: 0x5c5c5c }

// The icon: a body BODY pixels wide, a two-pixel terminal, then a column for the mark.
export const BW = 27
export const BH = 12
const BODY = 23
const CELLS = 5
// Inside the shell and a one-pixel gap: 5 cells of 3 pixels with 1-pixel gaps.
const IN = { x: 2, y: 2, w: 19, h: 8 }

export function batteryCells(percent: number | undefined, warn = false, pw = BW, ph = BH): string {
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const used = clamp(percent)
  const shell = used < 0 ? BT.dim : BT.shell
  const set = (x: number, y: number, c: number) => { if (x >= 0 && x < pw && y >= 0 && y < ph) px[y * pw + x] = c }
  // The shell, its corners cut so it reads rounded.
  for (let x = 1; x < BODY - 1; x += 1) { set(x, 0, shell); set(x, ph - 1, shell) }
  for (let y = 1; y < ph - 1; y += 1) { set(0, y, shell); set(BODY - 1, y, shell) }
  // The terminal nub, centred on the right.
  const nub = Math.round(ph / 2) - 2
  for (let y = nub; y < nub + 4; y += 1) { set(BODY, y, shell); set(BODY + 1, y, shell) }
  const span = (IN.w - (CELLS - 1)) / CELLS
  const lit = used < 0 ? 0 : Math.round((1 - used) * IN.w)
  const colour = zonePx(used * 100)
  for (let i = 0; i < lit; i += 1) {
    // Every (span + 1)th column is a gap between cells.
    if ((i + 1) % (span + 1) === 0) continue
    for (let y = IN.y; y < IN.y + IN.h && y < ph - 2; y += 1) set(IN.x + i, y, colour)
  }
  if (warn) {
    // A red exclamation mark beside the terminal.
    const mx = BODY + 3
    for (let y = 1; y < ph - 4; y += 1) set(mx, y, PX.red)
    for (let y = ph - 3; y < ph - 1; y += 1) set(mx, y, PX.red)
  }
  return encode(px, pw, ph)
}

const cell = (p: number | undefined, warn: boolean) => batteryCells(p, warn)

export const theme: ThemeDef = {
  id: 'battery',
  category: 'classic',
  gauges: (main, second, third) => [
    { ...main, w: BW, rows: BH / 2, cells: cell },
    { ...second, w: BW, rows: BH / 2, cells: cell },
    { ...third, w: BW, rows: BH / 2, cells: cell },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => (
    <Box flexDirection="row" columnGap={3}>
      {[main, second, third].map((d, i) => (
        <Box flexDirection="column" width={d.w} flexShrink={0}>
          <Raster key={`dial-${i}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
          <Text wrap="truncate-end">
            <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{d.limit ? `${d.limit.percent}%` : '––%'}</Text>
            <Text dimColor>{d.limit ? ' used' : ''}</Text>
          </Text>
          <Text wrap="truncate-end">{d.label}</Text>
          <Text dimColor wrap="truncate-end">{reset(d) || ' '}</Text>
          <Text color="error" bold wrap="truncate-end">{warned(d) ? empty(d) : ' '}</Text>
        </Box>
      ))}
    </Box>
  ),
}

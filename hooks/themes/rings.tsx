// The rings cluster: three round rings side by side, one per gauge slot
// (main, second, third; each shows its configured source), each
// filling clockwise from twelve o'clock over a dim track, with rounded ends
// and the percent in the hole. The ring is green, then yellow past 50% and
// red past 80%; a warned ring carries a red bead at its head.
import { clamp, encode, line, PX, reading, zone, zonePx } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// A ring N pixels across and N tall: N / 2 rows, an odd count so one row
// sits on the centre line and can carry the percent.
export const N = 22
export const THICK = 3

export function ringCells(percent: number | undefined, warn = false, n = N, thick = THICK): string {
  const px = new Uint32Array(n * n).fill(PX.none)
  const c = (n - 1) / 2
  const ro = n / 2
  const ri = ro - thick
  const rm = (ro + ri) / 2
  const round = 2 * Math.PI * rm
  const fill = clamp(percent)
  const colour = zonePx(fill * 100)
  // The head, in pixels along the ring's centre line; an empty ring shows a stub.
  const head = Math.max(fill * round, 1.5)
  // A warned ring stops short of its head to leave room for the bead.
  const gap = warn ? 2.9 : 0
  const stop = head - gap
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const r = Math.hypot(x - c, y - c)
      if (r < ri || r > ro) continue
      const cell = y * n + x
      px[cell] = PX.track
      if (fill < 0) continue
      let a = Math.atan2(x - c, c - y) / (2 * Math.PI)
      if (a < 0) a += 1
      const s = a * round
      // Clip the outer corners of each end so the ends look round.
      const edge = Math.abs(r - rm) > thick / 2 - 0.5
      const end = fill < 1 && edge && (s < 0.8 || stop - s < 0.8)
      if (s <= stop && !end) px[cell] = colour
      if (warn) {
        // Clear a gap either side of the head for the bead.
        let d = Math.abs(s - head)
        if (d > round / 2) d = round - d
        if (d <= gap || (edge && d <= gap + 0.8)) px[cell] = PX.none
      }
    }
  }
  if (warn) {
    // A red bead at the head.
    const t = (head / round) * 2 * Math.PI
    const bx = Math.round(c + rm * Math.sin(t))
    const by = Math.round(c - rm * Math.cos(t))
    for (let y = by - 1; y <= by + 1; y += 1) for (let x = bx - 1; x <= bx + 1; x += 1) px[y * n + x] = PX.red
  }
  return encode(px, n, n)
}

// Cut a block of cells out of an encoded raster (12 bytes a cell).
export function cut(cells: string, w: number, x: number, y: number, cw: number, ch: number): string {
  const src = Uint8Array.from(atob(cells), ch2 => ch2.charCodeAt(0))
  const out = new Uint8Array(cw * ch * 12)
  for (let row = 0; row < ch; row += 1) {
    out.set(src.subarray(((y + row) * w + x) * 12, ((y + row) * w + x + cw) * 12), row * cw * 12)
  }
  return (out as unknown as { toBase64(): string }).toBase64()
}

// Each ring stands in a column this wide, room for the empty-in warning.
const COL = 26

export const theme: ThemeDef = {
  id: 'rings',
  category: 'classic',
  gauges: (main, second, third) => [
    { ...main, w: N, rows: N / 2, cells: ringCells },
    { ...second, w: N, rows: N / 2, cells: ringCells },
    { ...third, w: N, rows: N / 2, cells: ringCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    const ring = (d: Dial, i: number) => {
      const cells = d.cells(d.limit?.percent, warned(d))
      const mid = (d.rows - 1) / 2
      // The ring's side on the centre row: up to the hole.
      const side = Math.ceil((d.w - 1) / 2 - Math.sqrt((d.w / 2 - THICK) ** 2 - 0.25))
      const hole = d.w - 2 * side
      return (
        <Box flexDirection="column" width={COL} flexShrink={0} alignItems="center">
          <Raster key={`dial-${i}`} columns={d.w} rows={mid} cells={cut(cells, d.w, 0, 0, d.w, mid)} />
          <Box flexDirection="row" width={d.w}>
            <Raster key={`dial-${i}-l`} columns={side} rows={1} cells={cut(cells, d.w, 0, mid, side, 1)} />
            <Box width={hole} flexShrink={0} justifyContent="center">
              <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{reading(d)}</Text>
            </Box>
            <Raster key={`dial-${i}-r`} columns={side} rows={1} cells={cut(cells, d.w, d.w - side, mid, side, 1)} />
          </Box>
          <Raster key={`dial-${i}-b`} columns={d.w} rows={mid} cells={cut(cells, d.w, 0, mid + 1, d.w, mid)} />
          <Text wrap="truncate-end">{d.label}</Text>
          <Text dimColor wrap="truncate-end">{line(reset(d))}</Text>
          <Text color="error" bold wrap="truncate-end">{warned(d) ? empty(d) : ' '}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2} paddingX={1}>{[main, second, third].map(ring)}</Box>
      </Box>
    )
  },
}

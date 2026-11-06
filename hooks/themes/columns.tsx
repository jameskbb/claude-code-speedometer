// The columns cluster: three segmented level columns side by side, one per
// gauge slot (main, second, third; each shows its configured source),
// filling from the bottom like a level meter. Each segment takes the
// zone colour of its height (green to 50%, yellow to 80%, red above) and
// unlit segments stay as a dim track in the same hue, so the scale is always
// visible. A warned column gets a bright red bar across its 80% mark.
import { clamp, encode, line, PX, reading, zone, zonePx } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// Dim versions of the zone colours for unlit segments, and a plain track for
// a gauge with no reading.
const DIM = { green: 0x1d3a24, yellow: 0x3d3218, red: 0x47201e, none: 0x2a2a2a }
const ALERT = 0xff3b30

// One segment per cell row: the top half-row lit, the bottom half the gap.
export const SEGS = 14
// The column's pixel width: the lit bar plus a pixel either side for the mark.
export const COLW = 9

const dimPx = (p: number) => (p >= 80 ? DIM.red : p >= 50 ? DIM.yellow : DIM.green)

// Segments lit for a fill of 0..1: rounded, but any use lights at least one.
export const litSegments = (fill: number, segs = SEGS) => (fill <= 0 ? 0 : Math.max(1, Math.round(fill * segs)))

export function columnCells(percent: number | undefined, warn = false, w = COLW, segs = SEGS): string {
  const pw = w
  const ph = segs * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const lit = fill < 0 ? 0 : litSegments(fill, segs)
  for (let i = 0; i < segs; i += 1) {
    // Segment i counts from the bottom; its colour is that of its middle.
    const mid = ((i + 0.5) / segs) * 100
    const colour = fill < 0 ? DIM.none : i < lit ? zonePx(mid) : dimPx(mid)
    const y = (segs - 1 - i) * 2
    for (let x = 1; x < pw - 1; x += 1) px[y * pw + x] = colour
  }
  if (warn) {
    // A bright red bar in the gap at the 80% mark, a pixel wider each side.
    const below = Math.round(0.8 * segs)
    const y = (segs - below) * 2 - 1
    for (let x = 0; x < pw; x += 1) px[y * pw + x] = ALERT
  }
  return encode(px, pw, ph)
}

// Each column's block: room for the empty-in warning under it.
const COL = 17
// The faint scale beside the first column.
const SCALE = 4

const scaleRows = () => {
  const rows: string[] = Array.from({ length: SEGS }, () => '')
  rows[0] = '100'
  rows[SEGS - Math.round(SEGS / 2)] = '50'
  rows[SEGS - 1] = '0'
  return rows
}

export const theme: ThemeDef = {
  id: 'columns',
  category: 'classic',
  gauges: (main, second, third) => [main, second, third].map(d => ({ ...d, w: COLW, rows: SEGS, cells: (p: number | undefined, warn: boolean) => columnCells(p, warn) })) as [Dial, Dial, Dial],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    const column = (d: Dial, i: number) => (
      <Box flexDirection="column" width={COL} flexShrink={0} alignItems="center">
        <Text color={d.limit ? zone(d.limit.percent) : 'inactive'} bold>{reading(d)}</Text>
        <Raster key={`dial-${i}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
        <Text dimColor wrap="truncate-end">{d.label}</Text>
        <Text dimColor wrap="truncate-end">{line(reset(d))}</Text>
        <Text color="error" bold wrap="truncate-end">{warned(d) ? empty(d) : ' '}</Text>
      </Box>
    )
    return (
      <Box flexDirection="row">
        <Box flexDirection="column" width={SCALE} flexShrink={0} alignItems="flex-end">
          <Text> </Text>
          {scaleRows().map(s => <Text dimColor>{s || ' '}</Text>)}
        </Box>
        {[main, second, third].map(column)}
      </Box>
    )
  },
}

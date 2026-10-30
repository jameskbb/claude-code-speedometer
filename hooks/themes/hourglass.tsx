// The hourglass cluster: three sand glasses standing on a wooden shelf, one
// per window. Sand left in the top bulb is what the window has left; the
// pile in the bottom bulb is what has been used, with a thin stream falling
// between them while the window is part used. The sand turns from green to
// amber to red as the window passes 50% and 80%, and a warned glass wears a
// red seal on its base. The 5-hour glass is the tall one in the middle.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const HG = {
  wood: 0x7a4a24, woodHi: 0xa8693a, woodLo: 0x4e2c12, post: 0xb5893a, postLo: 0x7a5a20,
  glass: 0x9fb8c4, glassHi: 0xdcecf2,
  green: 0x8fcf6a, amber: 0xe6a940, red: 0xe0583e, seal: 0xd0202a,
  panel: '#14110d', parchment: '#e6d8b4', shelf: '#6b4020',
}
const sandPx = (p: number) => (p >= 80 ? HG.red : p >= 50 ? HG.amber : HG.green)

// The big glass for the 5-hour window and the two smaller ones.
export const BIG = { w: 17, h: 24 }
export const SMALL = { w: 13, h: 20 }

// A glass w pixels across (odd, so the stream has a centre column) and h
// tall (even): a wooden cap top and bottom, brass posts down the sides, and
// two bulbs meeting at a one-pixel neck.
export function glassCells(w: number, h: number, percent: number | undefined, warn = false): string {
  const px = new Uint32Array(w * h).fill(PX.none)
  const cx = (w - 1) / 2
  const cap = 2
  const top = cap
  const bottom = h - cap - 1
  const mid = (top + bottom) / 2
  const wide = cx - 2
  // Half the bulb's inside width at row y: wide near the caps, pinched at the neck.
  const half = (y: number) => {
    const t = Math.abs(y - mid) / (bottom - mid)
    return Math.max(0, Math.round(wide * Math.sin(Math.min(1, t * 1.15) * Math.PI / 2) ** 0.8 - 0.2))
  }
  // The caps: lit along the top, shaded along the bottom, a little wider than the posts.
  for (let x = 0; x < w; x += 1) {
    px[0 * w + x] = HG.woodHi
    px[1 * w + x] = HG.wood
    px[(h - 2) * w + x] = HG.wood
    px[(h - 1) * w + x] = HG.woodLo
  }
  // The posts.
  for (let y = cap; y < h - cap; y += 1) { px[y * w + 1] = HG.post; px[y * w + w - 2] = HG.postLo }
  // The glass outline and the inside cells of each bulb, nearest the sand's resting place first.
  const upper: [number, number, number][] = []
  const lower: [number, number, number][] = []
  for (let y = top; y <= bottom; y += 1) {
    const hw = half(y)
    const l = Math.round(cx - hw - 1)
    const r = Math.round(cx + hw + 1)
    px[y * w + l] = HG.glass
    px[y * w + r] = HG.glass
    if (y > top && y < bottom && hw > 1) px[y * w + l + 1] = HG.glassHi
    for (let x = l + 1; x < r; x += 1) {
      if (y < mid) upper.push([x, y, (mid - y) + Math.abs(x - cx) * 0.15])
      else if (y > mid) lower.push([x, y, (bottom - y) + Math.abs(x - cx) * 0.7])
    }
  }
  // The rim where each bulb meets its cap.
  for (const y of [top, bottom]) for (let x = 2; x < w - 2; x += 1) if (px[y * w + x] === PX.none) px[y * w + x] = HG.glass
  const fill = clamp(percent)
  if (fill >= 0) {
    const colour = sandPx(fill * 100)
    // Sand fills three quarters of a bulb.
    const sand = Math.round(Math.min(upper.length, lower.length) * 0.75)
    const used = Math.round(sand * fill)
    upper.sort((a, b) => a[2] - b[2])
    lower.sort((a, b) => a[2] - b[2])
    for (const [x, y] of upper.slice(0, sand - used)) px[y * w + x] = colour
    for (const [x, y] of lower.slice(0, used)) px[y * w + x] = colour
    // The stream: from the neck down to the pile while sand is still above.
    if (used > 0 && used < sand) {
      const c = Math.round(cx)
      for (let y = Math.ceil(mid); y < bottom && px[y * w + c] !== colour; y += 1) px[y * w + c] = colour
    }
  }
  if (warn) {
    // A red seal on the base.
    for (let x = Math.round(cx) - 1; x <= Math.round(cx) + 1; x += 1) { px[(h - 2) * w + x] = HG.seal; px[(h - 1) * w + x] = HG.seal }
  }
  return encode(px, w, h)
}

export const bigGlass = (p: number | undefined, warn = false) => glassCells(BIG.w, BIG.h, p, warn)
export const smallGlass = (p: number | undefined, warn = false) => glassCells(SMALL.w, SMALL.h, p, warn)

// Each glass stands in a column this wide, room for the empty-in warning.
const COL = 22

export const theme: ThemeDef = {
  id: 'hourglass',
  category: 'beyond',
  gauges: (five, week, model) => [
    { ...five, w: BIG.w, rows: BIG.h / 2, cells: bigGlass },
    { ...week, w: SMALL.w, rows: SMALL.h / 2, cells: smallGlass },
    { ...model, w: SMALL.w, rows: SMALL.h / 2, cells: smallGlass },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty }: ThemeCtx) => {
    const glass = (d: Dial) => (
      <Box flexDirection="column" width={COL} flexShrink={0} alignItems="center">
        <Raster key={`dial-${d.label}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
      </Box>
    )
    const legend = (d: Dial) => (
      <Box flexDirection="column" width={COL} flexShrink={0} alignItems="center">
        <Text color={d.limit ? (d.limit.percent >= 80 ? '#e0583e' : d.limit.percent >= 50 ? '#e6a940' : '#8fcf6a') : 'inactive'} bold>
          {d.limit ? `${d.limit.percent}% used` : '––%'}
        </Text>
        <Text color={HG.parchment} wrap="truncate-end">{d.label}</Text>
        <Text dimColor wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    const order = [week, five, model]
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1} backgroundColor={HG.panel}>
          <Box flexDirection="row" columnGap={1} alignItems="flex-end">{order.map(glass)}</Box>
          {/* The shelf the glasses stand on. */}
          <Text color={HG.shelf}>{'▀'.repeat(COL * 3 + 2)}</Text>
          <Box flexDirection="row" columnGap={1}>{order.map(legend)}</Box>
        </Box>
      </Box>
    )
  },
}

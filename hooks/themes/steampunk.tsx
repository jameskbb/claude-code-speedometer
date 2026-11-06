// The steampunk cluster, after the brass pressure gauges on a Victorian
// boiler: cream faces in riveted brass bezels, black needles with a
// counterweight tail, a red danger sector at the top of each scale, and
// copper pipes joining them. The main gauge (the 5-hour window by default) is
// the boiler gauge in the middle; the second gauge hangs off the left pipe
// under a steam whistle and the third off the right one under a valve wheel.
import { clamp, encode, line, PX, reading } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

const SP = {
  face: 0xece0bf, faceShade: 0xd9c9a0, tick: 0x2a2018, red: 0xb3261e, needle: 0x141414,
  brass: 0xb5893a, brassHi: 0xe0bd62, brassLo: 0x7a5a20, rivet: 0x3d2a0e,
  copper: 0xb8643a, copperHi: 0xe08e5c, copperLo: 0x6e321a, collar: 0x5a3a14,
  wheel: 0xa02a1e, wheelHi: 0xd04a34, steam: 0xdcdcd4, lamp: 0xff3b2f,
  panel: '#1c140c', cream: '#e8dcb8', plate: '#c9a04a', plateInk: '#1a1208',
}
// The boiler gauge: a 24-pixel face with pipe stubs either side.
export const BW = 28
// The side gauges: a 16-pixel face and an 8-pixel run of pipe toward the boiler.
export const GW = 24
// Every gauge is 24 pixels (12 rows) tall, so the pipes meet at one height.
export const GH = 24
const PIPE = [11, 12, 13]

// A pressure gauge w pixels across with its face centred at (cx, cy), radius
// R, the needle swept clockwise over 270 degrees from the lower left.
function face(px: Uint32Array, pw: number, cx: number, cy: number, R: number, fill: number, warn: boolean) {
  const a0 = Math.PI * 1.25
  const span = Math.PI * 1.5
  const big = R >= 10
  const ticks = big ? 10 : 5
  const bezel = big ? 2.6 : 2.1
  for (let y = 0; y < GH; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      // The bezel: a dark rim, brass, and a lit edge toward the upper left.
      if (r > R - bezel) {
        px[y * pw + x] = r > R - 0.7 ? SP.brassLo : dx + dy > 0 ? SP.brassHi : SP.brass
        continue
      }
      // Aged paper, a little darker toward the rim.
      px[y * pw + x] = r > R - bezel - 1.2 ? SP.faceShade : SP.face
      let ang = a0 - Math.atan2(dy, dx)
      while (ang < 0) ang += 2 * Math.PI
      while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
      const frac = ang / span
      if (frac > 1.0001) continue
      const ring = r > R - bezel - (big ? 2.4 : 1.9)
      // The danger sector from 80 to 100.
      if (frac >= 0.8 && ring) px[y * pw + x] = SP.red
      const near = Math.abs(frac * ticks - Math.round(frac * ticks)) * (R * span) / ticks < 0.55
      if (near && ring) px[y * pw + x] = frac >= 0.8 ? SP.needle : SP.tick
    }
  }
  // Rivets round the bezel, eight on the boiler and six on the small gauges.
  const rivets = big ? 8 : 6
  for (let i = 0; i < rivets; i += 1) {
    const t = Math.PI / 2 + (i * 2 * Math.PI) / rivets
    const x = Math.round(cx + (R - bezel / 2 - 0.2) * Math.cos(t))
    const y = Math.round(cy - (R - bezel / 2 - 0.2) * Math.sin(t))
    px[y * pw + x] = SP.rivet
  }
  if (warn) {
    // A red lamp low on the face.
    const y = Math.round(cy + R * 0.55)
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) { px[(y - 1) * pw + x] = SP.lamp; px[y * pw + x] = SP.lamp }
  }
  if (fill >= 0) {
    // The needle: a counterweight tail behind the hub, broad near the hub on
    // the boiler gauge and tapering to a fine tip.
    const t = a0 - fill * span
    const len = R - bezel - 1
    for (let r = -(big ? 3 : 2); r < len; r += 0.25) {
      const x = cx + r * Math.cos(t)
      const y = cy - r * Math.sin(t)
      px[Math.round(y) * pw + Math.round(x)] = SP.needle
      if (big && r > -3 && r < len * 0.45) px[Math.round(y + 0.7 * Math.cos(t)) * pw + Math.round(x + 0.7 * Math.sin(t))] = SP.needle
    }
  }
  // The brass hub over the needle.
  for (const [x, y] of [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]) px[y! * pw + x!] = SP.brassHi
}

// A run of copper pipe from x0 to x1, lit along the top, and a collar where it meets a bezel.
function pipe(px: Uint32Array, pw: number, x0: number, x1: number, collar?: number) {
  for (let x = x0; x <= x1; x += 1) {
    px[PIPE[0]! * pw + x] = SP.copperHi
    px[PIPE[1]! * pw + x] = SP.copper
    px[PIPE[2]! * pw + x] = SP.copperLo
  }
  if (collar !== undefined) for (let y = PIPE[0]! - 1; y <= PIPE[2]! + 1; y += 1) px[y * pw + collar] = SP.collar
}

// The boiler gauge for the main slot, pipe stubs out both sides.
export function boilerCells(percent: number | undefined, warn = false): string {
  const pw = BW
  const px = new Uint32Array(pw * GH).fill(PX.none)
  pipe(px, pw, 0, 2)
  pipe(px, pw, pw - 3, pw - 1)
  face(px, pw, (pw - 1) / 2, (GH - 1) / 2, 12, clamp(percent), warn)
  return encode(px, pw, GH)
}

// The left gauge: its face, then pipe to the right under a brass steam
// whistle that blows once the needle is in the danger sector.
export function whistleCells(percent: number | undefined, warn = false): string {
  const pw = GW
  const px = new Uint32Array(pw * GH).fill(PX.none)
  pipe(px, pw, 15, pw - 1, 18)
  // The whistle: a stem off the pipe, a bell with a slot, a cap.
  for (let y = 8; y < PIPE[0]!; y += 1) { px[y * pw + 20] = SP.brass; px[y * pw + 21] = SP.brassLo }
  for (let y = 3; y < 8; y += 1) for (let x = 19; x <= 22; x += 1) px[y * pw + x] = x === 19 ? SP.brassHi : x === 22 ? SP.brassLo : SP.brass
  for (let x = 19; x <= 22; x += 1) px[6 * pw + x] = SP.rivet
  px[2 * pw + 20] = SP.brassHi
  px[2 * pw + 21] = SP.brass
  if (clamp(percent) >= 0.8) for (const [x, y] of [[20, 1], [21, 0], [22, 1], [23, 0], [19, 0]]) px[y! * pw + x!] = SP.steam
  face(px, pw, 7.5, (GH - 1) / 2, 8, clamp(percent), warn)
  return encode(px, pw, GH)
}

// The right gauge: pipe from the left under a red valve wheel, then its face.
export function valveCells(percent: number | undefined, warn = false): string {
  const pw = GW
  const px = new Uint32Array(pw * GH).fill(PX.none)
  pipe(px, pw, 0, 8, 6)
  // The valve: a stem off the pipe and a spoked wheel.
  for (let y = 7; y < PIPE[0]!; y += 1) { px[y * pw + 3] = SP.brass; px[y * pw + 4] = SP.brassLo }
  const wx = 3.5
  const wy = 3.5
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const r = Math.hypot(x - wx, y - wy)
      if (r > 2.6 && r < 3.7) px[y * pw + x] = y < wy ? SP.wheelHi : SP.wheel
      else if (r <= 2.6 && Math.abs(x - wx) + Math.abs(y - wy) < 1.1) px[y * pw + x] = SP.brass
      else if (r <= 2.6 && Math.abs(Math.abs(x - wx) - Math.abs(y - wy)) < 0.1) px[y * pw + x] = SP.wheel
    }
  }
  face(px, pw, pw - 8.5, (GH - 1) / 2, 8, clamp(percent), warn)
  return encode(px, pw, GH)
}

export const theme: ThemeDef = {
  id: 'steampunk',
  category: 'beyond',
  gauges: (main, second, third) => [
    { ...main, w: BW, rows: GH / 2, cells: boilerCells },
    { ...second, w: GW, rows: GH / 2, cells: whistleCells },
    { ...third, w: GW, rows: GH / 2, cells: valveCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    // A gauge and, under its face, a brass plate with the percent, then the label and reset.
    const gauge = (d: Dial, slot: string, side: 'flex-start' | 'center' | 'flex-end', faceCols: number) => (
      <Box flexDirection="column" width={d.w} flexShrink={0} alignItems={side}>
        <Raster key={`dial-${slot}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
        <Box flexDirection="column" width={faceCols} flexShrink={0} alignItems="center">
          <Text color={SP.plateInk} backgroundColor={SP.plate} bold>{` ${reading(d)} `}</Text>
          <Text color={SP.cream} wrap="truncate-end">{d.label}</Text>
          <Text dimColor wrap="truncate-end">{line(reset(d))}</Text>
        </Box>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1} backgroundColor={SP.panel} alignItems="flex-start">
          {gauge(second, 'second', 'flex-start', 16)}
          {gauge(main, 'main', 'center', BW)}
          {gauge(third, 'third', 'flex-end', 16)}
        </Box>
      </Box>
    )
  },
}

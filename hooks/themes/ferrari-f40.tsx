// The ferrari-f40 cluster, after the late-1980s mid-engine supercar's
// spartan analogue dash: round black-faced gauges with orange-red markings
// and white needles, set straight into a dark felt panel with no trim. A big
// tachometer in the middle with its redline band, the speedometer and a
// second main gauge either side, and small temperature, oil, boost and clock
// gauges between them.
import { clamp, encode, PX, seconds } from './kit'
import type { Dial, Gauge, ThemeCtx, ThemeDef } from './kit'

const F40 = {
  face: 0x050505, bezel: 0x3c3c3c, tick: 0xff7a1a, minor: 0xb85a18, redline: 0xe8261a, needle: 0xf4f4f4, hub: 0x5a5a5a, lamp: 0xff1f1f,
  panel: '#1a1918', orange: '#ff7a1a', white: '#f4f4f4', grey: '#8a8580',
}
// The tachometer, the two main gauges either side, and the small gauges.
export const TW = 22
export const MW = 18
export const SM = 10

// A round black face w pixels across (w even), its needle swept clockwise
// from angle a0 to a1 (radians, 0 is right): `ticks` long orange marks with a
// short one between each, and a solid redline band from `redFrom` on.
export function f40Cells(w: number, percent: number | undefined, warn: boolean, a0: number, a1: number, ticks: number, redFrom: number): string {
  const pw = w
  const ph = w
  const cx = (pw - 1) / 2
  const cy = (ph - 1) / 2
  const R = pw / 2 - 0.1
  const big = w >= MW
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fracAt = (dx: number, dy: number) => {
    let ang = a0 - Math.atan2(dy, dx)
    while (ang < 0) ang += 2 * Math.PI
    while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
    return ang / (a0 - a1)
  }
  const span = R * (a0 - a1)
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      if (r > R - 1) { px[y * pw + x] = F40.bezel; continue }
      px[y * pw + x] = F40.face
      const frac = fracAt(dx, dy)
      if (frac > 1.0001) continue
      if (frac >= redFrom && r > R - 2.2) { px[y * pw + x] = F40.redline; continue }
      const major = Math.abs(frac * ticks - Math.round(frac * ticks)) * span / ticks < 0.5
      const minor = big && Math.abs(frac * ticks * 2 - Math.round(frac * ticks * 2)) * span / (ticks * 2) < 0.35
      if (major && r > R - (big ? 3.4 : 2.4)) px[y * pw + x] = F40.tick
      else if (minor && r > R - 2.2) px[y * pw + x] = F40.minor
    }
  }
  const fill = clamp(percent)
  if (fill >= 0) {
    const t = a0 - fill * (a0 - a1)
    for (let r = -1.2; r < R - 1.6; r += 0.4) {
      const x = Math.round(cx + r * Math.cos(t))
      const y = Math.round(cy - r * Math.sin(t))
      px[y * pw + x] = F40.needle
    }
  }
  for (const [x, y] of [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]) px[y! * pw + x!] = F40.hub
  // A warned window lights a red tell-tale lamp low on its face.
  if (warn) {
    const y = Math.round(cy + R * 0.55)
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) { px[(y - 1) * pw + x] = F40.lamp; px[y * pw + x] = F40.lamp }
  }
  return encode(px, pw, ph)
}

// The tachometer reads clockwise through 240 degrees to a redline at 7,750
// of 10,000 rpm; the speedometer and model gauge share its sweep, redlined
// at 80%. The small gauges sweep 90 degrees across their top.
export const tachCells = (p: number | undefined, warn = false) => f40Cells(TW, p, warn, Math.PI * 7 / 6, Math.PI * -1 / 6, 10, 0.775)
export const mainCells = (p: number | undefined, warn = false) => f40Cells(MW, p, warn, Math.PI * 7 / 6, Math.PI * -1 / 6, 8, 0.8)
export const smallCells = (p: number | undefined, warn = false) => f40Cells(SM, p, warn, Math.PI * 0.75, Math.PI * 0.25, 2, 0.8)

const tach: Gauge = { w: TW, rows: TW / 2, cells: tachCells }
const main: Gauge = { w: MW, rows: MW / 2, cells: mainCells }

export const theme: ThemeDef = {
  id: 'ferrari-f40',
  category: 'vehicles',
  gauges: (five, week, model) => [{ ...five, ...tach }, { ...week, ...main }, { ...model, ...main }],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const gauge = (d: Dial, width: number) => (
      <Box flexDirection="column" width={width} flexShrink={0} alignItems="center">
        <Raster key={`dial-${d.label}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
        <Text color={F40.white} bold>{d.limit ? `${d.limit.percent}%` : '––%'}</Text>
        <Text color={F40.orange} wrap="truncate-end">{d.label}</Text>
        <Text color={F40.grey} wrap="truncate-end">{reset(d)}</Text>
        {warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>}
      </Box>
    )
    // Water temperature carries the context, oil the last turn's tool calls
    // (full at 20), boost the running subagents (full at 5), and the clock
    // the last turn's time (full at two minutes).
    const small = (key: string, label: string, gauge: number | undefined, value: string) => (
      <Box flexDirection="column" width={SM + 2} flexShrink={0} alignItems="center">
        <Raster key={key} columns={SM} rows={SM / 2} cells={smallCells(gauge)} />
        <Text wrap="truncate-end"><Text color={F40.orange}>{label} </Text><Text color={F40.white} bold>{value}</Text></Text>
      </Box>
    )
    const p = context.percent
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1} paddingX={1} backgroundColor={F40.panel} alignItems="flex-end">
          {gauge(week, MW)}
          <Box flexDirection="column" flexShrink={0}>
            {small('temp', 'TEMP', p, p === undefined ? '––' : `${p}%`)}
            {small('oil', 'OIL', Math.min(100, turn.tools * 5), `${turn.tools}`)}
            <Text> </Text>
            <Text> </Text>
            <Text> </Text>
          </Box>
          {gauge(five, TW)}
          <Box flexDirection="column" flexShrink={0}>
            {small('boost', 'BOOST', Math.min(100, running * 20), `${running}`)}
            {small('time', 'TIME', turn.count ? Math.min(100, turn.lastMs / 1200) : undefined, turn.count ? seconds(turn.lastMs) : '––')}
            <Text> </Text>
            <Text> </Text>
            <Text> </Text>
          </Box>
          {gauge(model, MW)}
        </Box>
      </Box>
    )
  },
}

// The weather-station cluster, after a brass-and-wood home weather station:
// a thermometer, a barometer and a hygrometer on a walnut panel. The 5-hour
// window is the thermometer on the left, its red column rising as the window
// heats up; the weekly window the big barometer in the middle, its words
// running from FAIR to STORMY; the model window the hygrometer on the right,
// which reads per cent anyway.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeDef } from './kit'

export const BW = 22
export const HW = 16
export const TW = 10
export const TR = 11

const WS = {
  brassHi: 0xf4d27a, brassLo: 0x8a6420, rim: 0x5a3e14, paper: 0xf3ead2, ink: 0x1a1410, red: 0xc8241c,
  fair: 0xd8a830, change: 0x9a9a8a, rain: 0x3a6ea8, dry: 0xc89a5a, comfort: 0x5a9a4a, damp: 0x3a6ea8,
  glass: 0xdfe8e4, mercury: 0xd8201a, mercuryDim: 0x7a3a30, warn: 0xff2a2a, hub: 0xb08a3a,
  wood: '#4a2c16', brass: '#e2bc62', cream: '#f4e8cc', grain: '#c8a070', plaque: '#d8b45a', plaqueInk: '#2a1c0c',
}

const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s
  return ch(16) | ch(8) | ch(0)
}

// Polished brass: lit from the upper left, darker toward the lower right.
const brass = (dx: number, dy: number, size: number) => mix(WS.brassHi, WS.brassLo, Math.max(0, Math.min(1, 0.5 + (dx - dy) / (2 * size))))

// A round dial w pixels across in a brass bezel: a paper face with a coloured
// band of zones, black ticks, and a black needle with a counterweight tail
// swept clockwise over 270 degrees; a red mark at the foot when warned.
function brassDial(w: number, percent: number | undefined, warn: boolean, zones: readonly (readonly [number, number])[], ticks: number): string {
  const pw = w
  const ph = w
  const cx = (pw - 1) / 2
  const cy = (ph - 1) / 2
  const R = pw / 2 - 0.1
  const a0 = Math.PI * 1.25
  const a1 = Math.PI * -0.25
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fracAt = (dx: number, dy: number) => {
    let ang = a0 - Math.atan2(dy, dx)
    while (ang < 0) ang += 2 * Math.PI
    while (ang >= 2 * Math.PI) ang -= 2 * Math.PI
    return ang / (a0 - a1)
  }
  const band = w >= BW ? 2 : 1.4
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const dx = x - cx
      const dy = cy - y
      const r = Math.hypot(dx, dy)
      if (r > R + 0.3) continue
      if (r > R - 1.2) { px[y * pw + x] = brass(dx, dy, R); continue }
      if (r > R - 2) { px[y * pw + x] = WS.rim; continue }
      px[y * pw + x] = WS.paper
      const frac = fracAt(dx, dy)
      if (frac > 1.0001) continue
      if (r > R - 2 - band) px[y * pw + x] = zones.find(([to]) => frac <= to)?.[1] ?? WS.red
      const near = Math.abs(frac * ticks - Math.round(frac * ticks)) * (R * (a0 - a1)) / ticks < 0.6
      if (near && r > R - 3.5 - band && r <= R - 2 - band) px[y * pw + x] = WS.ink
    }
  }
  const fill = clamp(percent)
  if (fill >= 0) {
    const t = a0 - fill * (a0 - a1)
    for (let r = -2; r < R - 2.5; r += 0.3) {
      px[Math.round(cy - r * Math.sin(t)) * pw + Math.round(cx + r * Math.cos(t))] = WS.ink
    }
  }
  for (const [x, y] of [[Math.floor(cx), Math.floor(cy)], [Math.ceil(cx), Math.floor(cy)], [Math.floor(cx), Math.ceil(cy)], [Math.ceil(cx), Math.ceil(cy)]]) px[y! * pw + x!] = WS.hub
  if (warn) {
    const y = Math.round(cy + R * 0.6)
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x += 1) { px[y * pw + x] = WS.warn; px[(y + 1) * pw + x] = WS.warn }
  }
  return encode(px, pw, ph)
}

// The barometer: FAIR in gold, CHANGE in grey, RAIN in blue, STORMY in red.
export const barometerCells = (percent: number | undefined, warn = false) =>
  brassDial(BW, percent, warn, [[0.4, WS.fair], [0.6, WS.change], [0.8, WS.rain]], 10)
// The hygrometer: DRY, COMFORT, DAMP, then WET in red.
export const hygrometerCells = (percent: number | undefined, warn = false) =>
  brassDial(HW, percent, warn, [[0.35, WS.dry], [0.6, WS.comfort], [0.8, WS.damp]], 4)

// The thermometer: a glass tube on a brass plate rounded at both ends, ticks
// either side (red at the top fifth), and a red column rising out of the
// bulb. With no reading only the bulb shows, dull; when warned the top of
// the plate turns red.
export function thermometerCells(percent: number | undefined, warn = false): string {
  const pw = TW
  const ph = TR * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const cx = (pw - 1) / 2
  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const end = y < 2 ? 2 - y : y > ph - 3 ? y - (ph - 3) : 0
      if (Math.abs(x - cx) > pw / 2 - end) continue
      px[y * pw + x] = brass(x - cx, ph / 2 - y, ph / 2)
    }
  }
  const top = 1
  const foot = ph - 5
  const fill = clamp(percent)
  for (let y = top; y <= foot; y += 1) {
    const frac = (foot - y) / (foot - top)
    const lit = fill >= 0 && frac <= fill + 0.001
    for (const x of [4, 5]) px[y * pw + x] = lit ? WS.mercury : WS.glass
    const step = foot - y
    if (step % 2 === 0) {
      const tick = frac >= 0.8 ? WS.red : WS.ink
      px[y * pw + 3] = tick
      px[y * pw + 6] = tick
      if (step % 4 === 0) { px[y * pw + 2] = tick; px[y * pw + 7] = tick }
    }
  }
  const by = ph - 4
  for (let y = foot + 1; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) if (Math.hypot(x - cx, y - by) <= 2.6) px[y * pw + x] = fill >= 0 ? WS.mercury : WS.mercuryDim
  }
  if (warn) for (let y = 0; y < 1; y += 1) for (let x = 0; x < pw; x += 1) if (px[y * pw + x] !== PX.none) px[y * pw + x] = WS.warn
  return encode(px, pw, ph)
}

// What each instrument would say about the weather at this reading.
const word = (d: Dial, words: readonly string[]) => (d.limit ? words[Math.min(words.length - 1, Math.floor((d.limit.percent / 100) * words.length))]! : '––')

export const theme: ThemeDef = {
  id: 'weather-station',
  category: 'beyond',
  gauges: (five, week, model) => [
    { ...five, w: TW, rows: TR, cells: thermometerCells },
    { ...week, w: BW, rows: BW / 2, cells: barometerCells },
    { ...model, w: HW, rows: HW / 2, cells: hygrometerCells },
  ],
  draw: ({ ui: { Box, Text, Raster }, five, week, model, warned, reset, empty }) => {
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const plaque = (name: string) => <Text color={WS.plaqueInk} backgroundColor={WS.plaque} bold>{` ${name} `}</Text>
    // Under each instrument: its brass name plate, the reading and its weather, the window, the reset, the warning.
    const legend = (d: Dial, name: string, words: readonly string[]) => [
      plaque(name),
      <Text wrap="truncate-end"><Text color={WS.cream} bold>{pct(d)}</Text><Text color={WS.brass}>{` ${word(d, words)}`}</Text></Text>,
      <Text color={WS.cream} wrap="truncate-end">{d.label}</Text>,
      <Text color={WS.grain} wrap="truncate-end">{reset(d)}</Text>,
      warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>,
    ]
    // The thermometer's scale, printed beside the tube at the height of its ticks.
    const scale = ['100', '', ' 75', '', ' 50', '', ' 25', '', '  0', '', '']
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2} paddingX={2} paddingY={1} backgroundColor={WS.wood} alignItems="flex-end">
          <Box flexDirection="column" width={18} flexShrink={0} alignItems="center">
            <Box flexDirection="row" columnGap={1}>
              <Box flexDirection="column" width={3} flexShrink={0}>
                {scale.map(s => <Text color={WS.brass}>{s || ' '}</Text>)}
              </Box>
              <Raster key={`dial-${five.label}`} columns={TW} rows={TR} cells={five.cells(five.limit?.percent, warned(five))} />
              <Box width={3} flexShrink={0}><Text> </Text></Box>
            </Box>
            {legend(five, 'THERMOMETER', ['COLD', 'COOL', 'MILD', 'WARM', 'HOT'])}
          </Box>
          <Box flexDirection="column" width={24} flexShrink={0} alignItems="center">
            <Raster key={`dial-${week.label}`} columns={BW} rows={BW / 2} cells={week.cells(week.limit?.percent, warned(week))} />
            {legend(week, 'BAROMETER', ['FAIR', 'FAIR', 'CHANGE', 'RAIN', 'STORMY'])}
          </Box>
          <Box flexDirection="column" width={18} flexShrink={0} alignItems="center">
            <Raster key={`dial-${model.label}`} columns={HW} rows={HW / 2} cells={model.cells(model.limit?.percent, warned(model))} />
            {legend(model, 'HYGROMETER', ['DRY', 'COMFORT', 'COMFORT', 'DAMP', 'WET'])}
          </Box>
        </Box>
      </Box>
    )
  },
}

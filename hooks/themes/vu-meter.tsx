// The vu-meter cluster, after the backlit VU meters on a 1970s hi-fi
// amplifier: two amber-lit windows with a black needle swinging up from a
// pivot hidden under a dark cover, a black scale turning red at 0 VU and a
// small red peak LED, set in a brushed-aluminium faceplate between walnut
// cheeks. The main gauge (the 5-hour window by default) is the left channel,
// the third gauge the right, and the second gauge a peak-hold LED ladder
// between them.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeDef } from './kit'

export const VW = 26
export const VR = 9
export const LW = 24
export const LR = 3

const VU = {
  lamp: 0xfff0c0, glow: 0xe9a94a, offLamp: 0x7a6c52, offGlow: 0x4e4434, ink: 0x15110d, red: 0xc41a1a,
  cover: 0x241c16, print: 0x8a6a3a, knurl: 0x3a3a3a, knobHi: 0xf4f4f0, knobLo: 0x8c8c88, bezel: 0x0c0c0c, led: 0xff2a2a, ledOff: 0x501616,
  ledGreen: 0x4cff6a, ledAmber: 0xffb020, ledRed: 0xff3030, dimGreen: 0x14361c, dimAmber: 0x3e2c08, dimRed: 0x401010,
  plate: '#c4c4bc', wood: '#5a3520', ink2: '#141414', engr: '#3c3c3c', scaleRed: '#b01818',
}

// Blend two 0xRRGGBB colours, t from 0 (a) to 1 (b).
const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s
  return ch(16) | ch(8) | ch(0)
}

// "VU" in a 3 by 5 pixel face, printed in the middle of the scale.
const GLYPHS = [[0b101, 0b101, 0b101, 0b101, 0b010], [0b101, 0b101, 0b101, 0b101, 0b111]]

// One meter window: a black bezel round an amber face, brightest low in the
// middle where the lamp sits; a scale arc over a pivot below the window, red
// from 0 VU (80%) up; the needle; the dark pivot cover with the peak LED,
// lit red when the gauge is warned. With no reading the lamp is off.
export function meterCells(percent: number | undefined, warn = false): string {
  const pw = VW
  const ph = VR * 2
  const px = new Uint32Array(pw * ph).fill(VU.bezel)
  const fill = clamp(percent)
  const lit = fill >= 0
  const cx = (pw - 1) / 2
  const cy = ph + 8
  const R = cy - 4
  const a0 = Math.PI * 0.645
  const a1 = Math.PI * 0.355
  const coverY = ph - 3
  for (let y = 1; y < ph - 1; y += 1) {
    for (let x = 1; x < pw - 1; x += 1) {
      const t = Math.min(1, Math.hypot((x - cx) / (pw / 2), (y - coverY) / ph) * 1.1)
      px[y * pw + x] = lit ? mix(VU.lamp, VU.glow, t) : mix(VU.offLamp, VU.offGlow, t)
      if (y >= coverY) px[y * pw + x] = VU.cover
    }
  }
  const plot = (r: number, a: number, c: number) => {
    const x = Math.round(cx + r * Math.cos(a))
    const y = Math.round(cy - r * Math.sin(a))
    if (x >= 1 && x < pw - 1 && y >= 1 && y < coverY) px[y * pw + x] = c
  }
  const at = (frac: number) => a0 - frac * (a0 - a1)
  // The scale line, doubled where it turns red; ticks crowd toward +3 as on the real dial.
  for (let f = 0; f <= 1; f += 0.004) {
    plot(R, at(f), f >= 0.8 ? VU.red : VU.ink)
    if (f >= 0.8) plot(R + 1, at(f), VU.red)
  }
  for (const [f, len] of [[0, 3], [0.25, 2], [0.45, 3], [0.6, 2], [0.7, 3], [0.8, 3], [0.87, 2], [0.94, 2], [1, 3]] as const) {
    for (let r = R + 1; r <= R + len; r += 1) plot(r, at(f), f >= 0.8 ? VU.red : VU.ink)
  }
  GLYPHS.forEach((g, i) => {
    const x0 = Math.round(cx - 3) + i * 4
    g.forEach((row, j) => { for (let b = 0; b < 3; b += 1) if (row & (4 >> b)) px[(8 + j) * pw + x0 + b] = VU.print })
  })
  if (lit) {
    const t = a0 - fill * (a0 - a1)
    for (let r = cy - coverY; r < R + 2.4; r += 0.3) {
      const x = Math.round(cx + r * Math.cos(t))
      const y = Math.round(cy - r * Math.sin(t))
      if (x >= 1 && x < pw - 1 && y >= 1 && y < coverY) px[y * pw + x] = VU.ink
    }
  }
  for (let y = coverY; y < ph - 1; y += 1) for (let x = pw - 5; x < pw - 3; x += 1) px[y * pw + x] = warn ? VU.led : VU.ledOff
  return encode(px, pw, ph)
}

// The peak-hold ladder between the meters: ten LEDs on a black strip, green,
// then amber from 50%, red from 80%, unlit ones dim; apart on the right, the
// PEAK LED, lit red when the gauge is warned.
export function ladderCells(percent: number | undefined, warn = false): string {
  const pw = LW
  const ph = LR * 2
  const px = new Uint32Array(pw * ph).fill(VU.bezel)
  const fill = clamp(percent)
  for (let i = 0; i < 10; i += 1) {
    const on = fill >= 0 && fill * 10 >= i + 0.5
    const c = i >= 7 ? (on ? VU.ledRed : VU.dimRed) : i >= 4 ? (on ? VU.ledAmber : VU.dimAmber) : on ? VU.ledGreen : VU.dimGreen
    for (let y = 1; y < ph - 1; y += 1) px[y * pw + 1 + 2 * i] = c
  }
  for (let y = 1; y < ph - 1; y += 1) for (let x = 21; x < 23; x += 1) px[y * pw + x] = warn ? VU.led : VU.ledOff
  return encode(px, pw, ph)
}

// Two knurled aluminium knobs for the faceplate under the ladder, pointers
// at ten and two o'clock; drawn once, they read nothing.
export function knobCells(): string {
  const pw = LW
  const ph = 6
  const px = new Uint32Array(pw * ph).fill(PX.none)
  for (const [kx, point] of [[6.5, Math.PI * 0.75], [16.5, Math.PI * 0.25]] as const) {
    const ky = 2.5
    for (let y = 0; y < ph; y += 1) {
      for (let x = 0; x < pw; x += 1) {
        const r = Math.hypot(x - kx, y - ky)
        if (r > 3.2) continue
        px[y * pw + x] = r > 2.4 ? VU.knurl : mix(VU.knobHi, VU.knobLo, Math.min(1, (x - kx + y - ky + 3) / 6))
      }
    }
    for (let r = 0; r < 3.1; r += 0.5) px[Math.round(ky - r * Math.sin(point)) * pw + Math.round(kx + r * Math.cos(point))] = VU.ink
  }
  return encode(px, pw, ph)
}

const meter = { w: VW, rows: VR, cells: meterCells }
const ladder = { w: LW, rows: LR, cells: ladderCells }

export const theme: ThemeDef = {
  id: 'vu-meter',
  category: 'beyond',
  gauges: (main, second, third) => [{ ...main, ...meter }, { ...second, ...ladder }, { ...third, ...meter }],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }) => {
    const pct = (d: Dial) => (d.limit ? `${d.limit.percent}%` : '––%')
    const tone = (d: Dial) => (d.limit && d.limit.percent >= 80 ? VU.scaleRed : VU.ink2)
    const warning = (d: Dial) => (warned(d) ? <Text color="error" bold inverse wrap="truncate-end">{` ${empty(d)} `}</Text> : <Text> </Text>)
    const channel = (d: Dial, slot: string, side: string) => (
      <Box flexDirection="column" width={VW} flexShrink={0} alignItems="center">
        <Raster key={`dial-${slot}`} columns={VW} rows={VR} cells={d.cells(d.limit?.percent, warned(d))} />
        <Text wrap="truncate-end"><Text color={VU.engr}>{`${side}  `}</Text><Text color={tone(d)} bold>{pct(d)}</Text></Text>
        <Text color={VU.ink2} wrap="truncate-end">{d.label}</Text>
        <Text color={VU.engr} wrap="truncate-end">{reset(d) || ' '}</Text>
        {warning(d)}
      </Box>
    )
    const cheek = <Box width={2} flexShrink={0} backgroundColor={VU.wood}><Text> </Text></Box>
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {cheek}
          <Box flexDirection="row" columnGap={1} paddingX={1} backgroundColor={VU.plate} alignItems="flex-start">
            {channel(main, 'main', 'LEFT')}
            <Box flexDirection="column" width={LW} flexShrink={0} alignItems="center">
              <Text color={VU.engr} wrap="truncate-end">{'PEAK  HOLD'}</Text>
              <Raster key="dial-second" columns={LW} rows={LR} cells={second.cells(second.limit?.percent, warned(second))} />
              {/* The scale under the LEDs, red from 0 VU like the meters. */}
              <Text wrap="truncate-end"><Text color={VU.engr}>{'-20   -10  -5  '}</Text><Text color={VU.scaleRed} bold>{'0  +3 PK'}</Text></Text>
              <Text color={tone(second)} bold>{pct(second)}</Text>
              <Text color={VU.ink2} wrap="truncate-end">{second.label}</Text>
              <Text color={VU.engr} wrap="truncate-end">{reset(second) || ' '}</Text>
              {warning(second)}
              <Raster key="knobs" columns={LW} rows={3} cells={knobCells()} />
              <Text color={VU.engr} wrap="truncate-end">{' BALANCE    VOLUME'}</Text>
            </Box>
            {channel(third, 'third', 'RIGHT')}
          </Box>
          {cheek}
        </Box>
      </Box>
    )
  },
}

// The digital cluster: no dials, three big-number tiles side by side, one per
// gauge slot (main, second, third; each shows its configured source). Each
// gauge's percent is drawn in large pixel numerals coloured by its zone,
// with a thin progress line under it and the label and reset in small text.
// A warned tile gets a red dot by its number. With no reading, dashes.
import { clamp, encode, PX } from './kit'
import type { Dial, ThemeCtx, ThemeDef } from './kit'

// A tile's width in cells, and its numerals' height in pixels (seven rows).
export const TILE = 28
export const NH = 14

const DG = { ghost: 0x4a4a4a, track: '#3a3a3a', dim: '#8b8b8b' }

// Digits are 7 by 14 with strokes two pixels thick, so every stroke lands on
// whole half-rows: a top, b upper right, c lower right, d bottom, e lower
// left, f upper left, g middle.
const DW7 = 7
const SEG: Record<string, [number, number, number, number]> = {
  a: [0, 0, 6, 1], b: [5, 0, 6, 7], c: [5, 6, 6, 13], d: [0, 12, 6, 13],
  e: [0, 6, 1, 13], f: [0, 0, 1, 7], g: [0, 6, 6, 7],
}
const DIGIT: Record<string, string> = {
  0: 'abcdef', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg',
  6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
}

// A glyph as its width and lit pixels.
type Glyph = { w: number; on: [number, number][] }

function digit(ch: string): Glyph {
  if (ch === '1') {
    // Narrower than the rest: a stem with a short flag.
    const on: [number, number][] = [[0, 2], [0, 3], [1, 1], [1, 2]]
    for (let y = 0; y < NH; y += 1) on.push([2, y], [3, y])
    return { w: 4, on }
  }
  const lit = new Set<string>()
  for (const s of DIGIT[ch] ?? '') {
    const [x0, y0, x1, y1] = SEG[s]!
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) lit.add(`${x},${y}`)
  }
  // Soften the outer corners for a rounder, quieter face.
  for (const c of ['0,0', '6,0', '0,13', '6,13']) lit.delete(c)
  return { w: DW7, on: [...lit].map(k => k.split(',').map(Number) as [number, number]) }
}

// A small percent sign, 7 by 7, sitting on the baseline.
const PCT: Glyph = {
  w: 7,
  on: ['XXX...X', 'X.X..X.', 'XXX.X..', '...X...', '..X.XXX', '.X..X.X', 'X...XXX']
    .flatMap((row, y) => [...row].flatMap((c, x) => (c === 'X' ? [[x, y + NH - 7] as [number, number]] : []))),
}

// A tile w cells wide: the percent in big numerals from the left edge, then
// the percent sign; a red dot above the percent sign when warned. Glyphs sit
// two pixels apart, one where that would not fit (100%).
export function readoutCells(percent: number | undefined, warn = false, w = TILE): string {
  const pw = w
  const ph = NH
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const fill = clamp(percent)
  const value = fill < 0 ? undefined : Math.round(fill * 100)
  const text = value === undefined ? '--' : String(value)
  const colour = value === undefined ? DG.ghost : value >= 80 ? PX.red : value >= 50 ? PX.yellow : PX.green
  const glyphs = [...[...text].map(digit), PCT]
  const wide = glyphs.reduce((n, g) => n + g.w, 0)
  const gap = wide + 2 * (glyphs.length - 1) <= pw ? 2 : 1
  let x0 = 0
  for (const g of glyphs) {
    for (const [x, y] of g.on) if (x0 + x < pw) px[y * pw + x0 + x] = colour
    x0 += g.w + gap
  }
  if (warn) {
    // A round dot, 4 by 4, centred over the percent sign.
    const left = Math.min(pw - 4, x0 - gap - PCT.w + 2)
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
      if ((y === 0 || y === 3) && (x === 0 || x === 3)) continue
      px[y * pw + left + x] = PX.red
    }
  }
  return encode(px, pw, ph)
}

// The thin progress line under a number: zone-coloured fill on a dark track.
const line = (d: Dial) => {
  const p = d.limit?.percent
  const on = p === undefined ? 0 : Math.round((Math.max(0, Math.min(100, p)) / 100) * TILE)
  const tone = p === undefined ? DG.track : p >= 80 ? '#f85149' : p >= 50 ? '#d29922' : '#3fb950'
  return { on, tone }
}

export const theme: ThemeDef = {
  id: 'digital',
  category: 'classic',
  gauges: (main, second, third) => [
    { ...main, w: TILE, rows: NH / 2, cells: (p, warn) => readoutCells(p, warn) },
    { ...second, w: TILE, rows: NH / 2, cells: (p, warn) => readoutCells(p, warn) },
    { ...third, w: TILE, rows: NH / 2, cells: (p, warn) => readoutCells(p, warn) },
  ],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty }: ThemeCtx) => {
    const tile = (d: Dial, i: number) => {
      const l = line(d)
      return (
        <Box flexDirection="column" width={TILE} flexShrink={0}>
          <Raster key={`dial-${i}`} columns={d.w} rows={d.rows} cells={d.cells(d.limit?.percent, warned(d))} />
          <Text>
            <Text color={l.tone}>{'━'.repeat(l.on)}</Text>
            <Text color={DG.track}>{'─'.repeat(TILE - l.on)}</Text>
          </Text>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold wrap="truncate-end">{d.label}</Text>
            <Text color={DG.dim} wrap="truncate-end">{reset(d)}</Text>
          </Box>
          <Text color="error" bold wrap="truncate-end">{warned(d) ? empty(d) : ' '}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>{[main, second, third].map(tile)}</Box>
      </Box>
    )
  },
}

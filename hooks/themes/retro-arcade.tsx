// The retro-arcade cluster, after an 8-bit arcade heads-up display on a CRT:
// a black screen, a score line across the top, and one player card per
// gauge with a row of pixel hearts over a segmented health bar: P1 the main
// gauge (the 5-hour window by default), P2 the second, P3 the third. What is
// left of the gauge is your health, so both empty as it is used. A warned
// gauge rings its health bar in red and flashes LOW HEALTH; a spent one, GAME
// OVER; one with no reading yet, a context gauge included, INSERT COIN.
import { clamp, encode, line, pct, PX, reading } from './kit'
import type { Dial, Gauge, ThemeCtx, ThemeDef } from './kit'

// The pixels: a red heart with a white shine and darker edge, a lost heart
// in deep maroon, grey with no reading, and the bar in arcade green to red.
const AR = {
  heart: 0xff2b4e, shine: 0xffffff, shade: 0xa8102c, lost: 0x3a1420, off: 0x262628,
  green: 0x39ff6a, yellow: 0xffd23f, red: 0xff2b4e, unlit: 0x1e1e22, frame: 0x8a8a96,
}
// The text colours.
const TX = { panel: '#000000', white: '#f4f4f4', yellow: '#ffd23f', green: '#39ff6a', cyan: '#3ff2ff', magenta: '#ff4fd8', red: '#ff2b4e', grey: '#8a8a96', dim: '#55555f' }
export const AW = 27
export const AROWS = 7
// Three hearts across; each is a third of the gauge's health.
export const HEARTS = 3
export const SEGS = 8

// One heart, 7 by 6: H a shine pixel, R body, D the shaded edge.
const HEART = ['.RR.RR.', 'RHRRRRR', 'RRRRRRD', '.RRRRD.', '..RRD..', '...D...']

// Health is what is left: 100 less the percent used, 0 to 1, or -1 with no reading.
export const health = (percent: number | undefined) => { const f = clamp(percent); return f < 0 ? -1 : 1 - f }

// The bar's colour by health left: green, then yellow under half, red under a quarter.
const hpPx = (hp: number) => (hp > 0.5 ? AR.green : hp > 0.25 ? AR.yellow : AR.red)

// A player card's pixels: three hearts that empty right to left, a column at
// a time, over an eight-segment health bar in a grey frame (red when warned).
export function heartsCells(percent: number | undefined, warn = false): string {
  const pw = AW
  const ph = AROWS * 2
  const px = new Uint32Array(pw * ph).fill(PX.none)
  const hp = health(percent)
  for (let i = 0; i < HEARTS; i += 1) {
    const x0 = 1 + i * 9
    const part = hp < 0 ? 0 : Math.max(0, Math.min(1, hp * HEARTS - i))
    const lit = Math.round(part * 7)
    HEART.forEach((line, dy) => {
      for (let dx = 0; dx < 7; dx += 1) {
        const c = line[dx]
        if (c === '.') continue
        const on = dx < lit
        px[(1 + dy) * pw + x0 + dx] = hp < 0 ? AR.off : !on ? AR.lost : c === 'H' ? AR.shine : c === 'D' ? AR.shade : AR.heart
      }
    })
  }
  // The bar: eight two-pixel segments inside a one-pixel frame, a black
  // gutter between them so a red segment still reads in a red frame.
  const top = 8
  const ring = warn ? AR.red : AR.frame
  for (let x = 0; x < pw; x += 1) { px[top * pw + x] = ring; px[(top + 5) * pw + x] = ring }
  for (let y = top + 1; y < top + 5; y += 1) { px[y * pw] = ring; px[y * pw + pw - 1] = ring }
  const on = hp <= 0 ? 0 : Math.ceil(hp * SEGS - 1e-9)
  for (let s = 0; s < SEGS; s += 1) {
    const color = hp < 0 || s >= on ? AR.unlit : hpPx(hp)
    for (const y of [top + 2, top + 3]) for (const dx of [0, 1]) px[y * pw + 2 + s * 3 + dx] = color
  }
  return encode(px, pw, ph)
}

const card: Gauge = { w: AW, rows: AROWS, cells: heartsCells }
// Each card is a player: its tag, colour and slot.
const PLAYERS: [string, string, string][] = [['P1', TX.red, 'main'], ['P2', TX.cyan, 'second'], ['P3', TX.magenta, 'third']]

const digits = (n: number | undefined, width = 7) => (n === undefined ? '-'.repeat(width) : String(Math.max(0, Math.round(n))).padStart(width, '0').slice(-width))

export const theme: ThemeDef = {
  id: 'retro-arcade',
  category: 'beyond',
  gauges: (main, second, third) => [{ ...main, ...card }, { ...second, ...card }, { ...third, ...card }],
  draw: ({ ui: { Box, Text, Raster }, main, second, third, warned, reset, empty, context, turn, running }: ThemeCtx) => {
    const t = (text: string, color: string, bold = false) => <Text color={color} bold={bold} wrap="truncate-end">{text}</Text>
    // A score column: a red label over white digits, as arcade tops are.
    const score = (label: string, value: string, color = TX.white) => (
      <Box flexDirection="column" flexShrink={0}>
        {t(label, TX.red, true)}
        {t(value, color, true)}
      </Box>
    )
    const player = (d: Dial, i: number) => {
      const [tag, color, slot] = PLAYERS[i]!
      const hp = health(d.limit?.percent)
      return (
        <Box key={`player-${slot}`} flexDirection="column" width={AW} flexShrink={0}>
          <Text wrap="truncate-end"><Text color={TX.panel} backgroundColor={color} bold>{` ${tag} `}</Text><Text color={TX.white} bold>{` ${d.label.toUpperCase()}`}</Text></Text>
          <Raster key={`dial-${slot}`} columns={AW} rows={AROWS} cells={d.cells(d.limit?.percent, warned(d))} />
          <Text wrap="truncate-end">
            <Text color={TX.yellow} bold>{reading(d)}</Text>
            <Text color={TX.grey}>{' USED  '}</Text>
            <Text color={TX.grey}>{'HP '}</Text>
            <Text color={hp < 0 ? TX.dim : hp > 0.5 ? TX.green : hp > 0.25 ? TX.yellow : TX.red} bold>{hp < 0 ? '––' : String(Math.round(hp * 100)).padStart(2, '0')}</Text>
          </Text>
          {t(line(reset(d)), TX.grey)}
          {/* The banner: no reading is a game not started, 100% is over. */}
          {!d.limit ? t('INSERT COIN', TX.yellow, true)
            : d.limit.percent >= 100 ? <Text color={TX.red} bold inverse wrap="truncate-end">{' GAME OVER '}</Text>
            : warned(d) ? <Text color={TX.red} bold inverse wrap="truncate-end">{' ▶ LOW HEALTH ◀ '}</Text>
            : <Text> </Text>}
          {warned(d) ? t(empty(d), TX.red, true) : <Text> </Text>}
        </Box>
      )
    }
    // The score line: context tokens are the score and the context window the high score;
    // turns are the stage, cost the credit, and running subagents the agents.
    return (
      <Box flexDirection="column" backgroundColor={TX.panel} paddingX={1}>
        <Text> </Text>
        <Box flexDirection="row" width={3 * AW + 4} justifyContent="space-between">
          {score('1UP', digits(context.tokens))}
          {score('HI-SCORE', digits(context.window))}
          {score('CTX', pct(context.percent), TX.cyan)}
          {score('STAGE', String(turn.count).padStart(2, '0'), TX.yellow)}
          {score('CREDIT', context.usd === undefined ? '–' : `$${context.usd.toFixed(2)}`, TX.yellow)}
          {score('AGENTS', String(running), TX.green)}
        </Box>
        <Text> </Text>
        <Box flexDirection="row" columnGap={2}>
          {[main, second, third].map(player)}
        </Box>
        <Text> </Text>
      </Box>
    )
  },
}

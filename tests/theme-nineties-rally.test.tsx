import { expect, mock, test } from 'claude-code/testing'

import { clusterCells, CR, CW, rallyCells, mainCells, smallCells, tachCells } from '../hooks/themes/nineties-rally'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const size = (cells: string) => Uint8Array.from(atob(cells), c => c.charCodeAt(0)).length
const CASES = [[undefined, false], [0, false], [37, false], [62, true], [84, false], [100, true]] as const

test('each nineties-rally painter fills exactly its grid', () => {
  for (const [p, warn] of CASES) {
    expect(size(tachCells(p, warn))).toBe(24 * 12 * 12)
    expect(size(mainCells(p, warn))).toBe(18 * 9 * 12)
    expect(size(smallCells(p, warn))).toBe(10 * 5 * 12)
    expect(size(rallyCells(14, p, warn))).toBe(14 * 7 * 12)
    const r = { five: p, week: p, model: p, context: p, tools: 7, agents: 1, warn: [warn, warn, warn] as [boolean, boolean, boolean] }
    expect(size(clusterCells(r))).toBe(CW * CR * 12)
    expect(size(clusterCells(r, 60, 10))).toBe(60 * 10 * 12)
  }
})

test('a warned nineties-rally gauge draws differently', () => {
  expect(tachCells(62, true)).not.toBe(tachCells(62, false))
  expect(mainCells(62, true)).not.toBe(mainCells(62, false))
  const r = { five: 62, week: 37, model: 84, context: 42, tools: 7, agents: 1 }
  expect(clusterCells({ ...r, warn: [true, false, false] })).not.toBe(clusterCells({ ...r, warn: [false, false, false] }))
})

test('the nineties-rally theme draws the pane', { options: { theme: 'nineties-rally' } }, async ($, on) => {
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /no reading/ })).toBeDefined()
  await ui.unmount()
})

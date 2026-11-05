import { expect, mock, test } from 'claude-code/testing'

import { resolveTheme, THEME_ALIASES, THEMES } from '../hooks/register'

const PANE = {
  plugin: 'speedometer',
  component: 'Pane',
  requestId: 'speedometer',
  props: { title: 'Speedometer', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const OLD = ['corvette-c4', 'mustang-terminator', 'lamborghini-huracan', 'porsche-911', 'ferrari-f40', 'tron-lightcycle', 'f1-wheel', 'skyline-r34', 'knight-rider', 'bel-air-1957', 'delorean', 'wrx-gc8']

test('every old theme id still resolves to its renamed cluster', () => {
  expect(Object.keys(THEME_ALIASES).sort()).toEqual([...OLD].sort())
  for (const old of OLD) {
    expect(THEMES).not.toContain(old)
    expect(THEMES).toContain(THEME_ALIASES[old])
    expect(resolveTheme(old)).toBe(THEME_ALIASES[old])
  }
  expect(resolveTheme('corvette-c4')).toBe('eighties-digital-dash')
  expect(resolveTheme('tron-lightcycle')).toBe('neon-grid')
})

test('current ids resolve to themselves and anything else to classic', () => {
  for (const t of THEMES) expect(resolveTheme(t)).toBe(t)
  expect(resolveTheme('no-such-theme')).toBe('classic')
  expect(resolveTheme(undefined)).toBe('classic')
  expect(resolveTheme(3)).toBe('classic')
})

// The engine hands register an old id as unset; the plugin reads the saved
// value at session start, draws the renamed cluster and saves the new id.
test('a saved old id draws the renamed cluster and is saved as the new id', async ($, on) => {
  mock.clock(on)
  const saved: unknown[] = []
  on('settings.read', () => ({ value: { pluginConfigs: { 'speedometer@speedometer': { options: { theme: 'tron-lightcycle' } } } } }))
  on('config.set', (_$, e) => { saved.push([e.key, e.value]); return { value: e.value } })
  on('command.register', () => ({ value: { command: 'speedometer' } }))
  on('session.usage', () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }))
  on('session.authorize', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: false } }))
  on('session.start', () => ({ cwd: '/proj' }) as never)
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.root', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home/x' }))
  await $.session.start({ cwd: '/proj', surface: 'terminal' } as never)
  expect(saved).toEqual([['speedometer.theme', 'neon-grid']])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^AGENTS \d/ })).toBeDefined()
  await ui.unmount()
})

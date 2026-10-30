// Checks that README.md keeps up with the clusters. Read-only; scripts/check.sh runs it.
//   node scripts/check-readme.mjs
// For every theme option in .claude-plugin/plugin.json: docs/images/cluster-<id>.png
// exists, the README shows it exactly once (with alt text), under the ### heading
// of the theme's category, with its **`id`** entry under the same heading. No
// cluster image is left without an option, the contact sheet exists, and every
// cluster count the README states (a heading's "(N)", or "N clusters") is right.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const options = JSON.parse(read('.claude-plugin/plugin.json')).userConfig.theme.options
const readme = read('README.md')
const HEADING = { classic: 'Plain', vehicles: 'Vehicle dashboards', beyond: 'Beyond the road' }
const problems = []

// A theme's category: the built-ins from register.tsx's BUILTIN_CATEGORY, every other from its ThemeDef file.
const builtinSrc = read('hooks/register.tsx').match(/BUILTIN_CATEGORY[^=]*=\s*\{([^}]*)\}/)?.[1] ?? ''
const BUILTIN = Object.fromEntries([...builtinSrc.matchAll(/'?([\w-]+)'?\s*:\s*'(\w+)'/g)].map(m => [m[1], m[2]]))
const categoryOf = id => {
  if (BUILTIN[id]) return BUILTIN[id]
  const file = `hooks/themes/${id}.tsx`
  if (!fs.existsSync(path.join(root, file))) return undefined
  return read(file).match(/category:\s*'(\w+)'/)?.[1]
}

// The ### heading each README line falls under, without a trailing "(N)".
const lines = readme.split('\n')
const sectionAt = []
let current = ''
for (const line of lines) {
  const h = line.match(/^###\s+(.*?)\s*(?:\((\d+)\))?\s*$/)
  if (h) current = h[1]
  sectionAt.push(current)
}

const count = {}
for (const id of options) {
  const cat = categoryOf(id)
  const want = HEADING[cat]
  if (!want) { problems.push(`${id}: no category found (built-in map in hooks/register.tsx, or category: in hooks/themes/${id}.tsx)`); continue }
  count[want] = (count[want] ?? 0) + 1
  const img = `docs/images/cluster-${id}.png`
  if (!fs.existsSync(path.join(root, img))) problems.push(`${id}: no ${img}`)
  const at = lines.flatMap((l, i) => (l.includes(`src="${img}"`) ? [i] : []))
  if (at.length !== 1) { problems.push(`${id}: README shows ${img} ${at.length} times, want once`); continue }
  if (!/alt="[^"]{12,}"/.test(lines[at[0]])) problems.push(`${id}: README image has no alt text`)
  if (sectionAt[at[0]] !== want) problems.push(`${id}: README image is under "${sectionAt[at[0]] || 'no heading'}", its category is "${want}"`)
  const entry = lines.findIndex((l, i) => l.includes(`**\`${id}\`**`) && sectionAt[i] === want)
  if (entry < 0) problems.push(`${id}: no **\`${id}\`** entry under "${want}"`)
}

for (const f of fs.readdirSync(path.join(root, 'docs/images'))) {
  const m = f.match(/^cluster-(.*)\.png$/)
  if (m && !options.includes(m[1])) problems.push(`orphan image docs/images/${f}: no /config option ${m[1]}`)
}
if (!fs.existsSync(path.join(root, 'docs/images/clusters-sheet.png'))) problems.push('no docs/images/clusters-sheet.png')
if (!readme.includes('src="docs/images/clusters-sheet.png"')) problems.push('README does not show the contact sheet')

// Stated counts: "### Plain (7)" and any "N clusters" / "N gauge clusters".
for (const line of lines) {
  const h = line.match(/^###\s+(.*?)\s*\((\d+)\)\s*$/)
  if (h && HEADING[Object.keys(HEADING).find(k => HEADING[k] === h[1])] && Number(h[2]) !== (count[h[1]] ?? 0)) problems.push(`README heading "${line.trim()}": there are ${count[h[1]] ?? 0}`)
}
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const asNumber = s => (/^\d+$/.test(s) ? Number(s) : words.indexOf(s.toLowerCase()))
for (const m of readme.matchAll(/\b(\d+|[A-Za-z]+(?:-[a-z]+)?) (?:gauge )?clusters\b/g)) {
  let n = asNumber(m[1])
  if (n < 0 && m[1].includes('-')) { const [t, u] = m[1].toLowerCase().split('-'); n = { twenty: 20, thirty: 30, forty: 40 }[t] + words.indexOf(u) }
  if (Number.isFinite(n) && n >= 0 && n !== options.length) problems.push(`README says "${m[0]}", there are ${options.length}`)
}

console.log(problems.length ? `README out of sync:\n  ${problems.join('\n  ')}` : `README in sync: ${options.length} clusters`)
process.exit(problems.length ? 1 : 0)

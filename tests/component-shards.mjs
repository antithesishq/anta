import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { componentSuites } from './component-suites.mjs'

const suiteNames = {
  'input-autocomplete': 'InputAutocomplete',
  'input-time': 'InputTime',
  selection: 'Selection state',
  'value-ownership': 'Controlled and uncontrolled values',
}

export function componentShards(selection) {
  const selected = Object.keys(componentSuites).filter(name => selection[name] === 'true')
  const groups = Array.from({length: Math.min(4, selected.length)}, () => [])
  for (const [index, name] of selected.entries()) groups[index % groups.length].push(name)
  return {include: groups.map(names => ({
    name: names.map(name => suiteNames[name] ?? name[0].toUpperCase() + name.slice(1)).join(', '),
    components: names.join(','),
  }))}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const matrix = componentShards(JSON.parse(process.env.COMPONENT_TEST_SELECTION))
  await appendFile(process.env.GITHUB_OUTPUT,
    `matrix=${JSON.stringify(matrix)}\nhas-components=${matrix.include.length > 0}\n`)
}

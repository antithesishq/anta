import fs from 'node:fs'
import path from 'node:path'
import * as hegel from '@hegeldev/hegel'
import * as g from '@hegeldev/hegel/generators'

const DEFAULT_SEED = 20250308
const requestedSeed = process.env.HEGEL_SEED
const SEED = requestedSeed == null ? DEFAULT_SEED : Number(requestedSeed)
if (!Number.isSafeInteger(SEED) || SEED < 0) {
  throw new Error(`HEGEL_SEED must be a non-negative safe integer, received ${JSON.stringify(requestedSeed)}`)
}
const runId = process.env.HEGEL_RUN_ID ?? String(Date.now())
const corpusPath = process.env.HEGEL_OUTPUT_PATH
  ? path.resolve(process.env.HEGEL_OUTPUT_PATH)
  : path.resolve(import.meta.dirname, '.test-output', runId, 'apps.json')
const words = ['atlas', 'birch', 'coral', 'drift', 'ember', 'field', 'glow', 'harbor', 'iris', 'juniper']
const shortWord = g.sampledFrom(words)
const nonEmptyLabel = g.oneOf(
  shortWord, shortWord, shortWord, shortWord, shortWord,
  g.text({ minSize: 1, maxSize: 20 }),
  g.sampledFrom(['✨', 'مرحبا', 'hello 🙂', 'e\u0301lan']),
)
const editableText = g.oneOf(
  shortWord, shortWord, shortWord,
  g.text({ minSize: 0, maxSize: 24 }),
  g.sampledFrom(['hello 🙂', 'مرحبا بالعالم', 'e\u0301lan', 'line one\nline two']),
)
const singleLineInputText = g.oneOf(
  shortWord, shortWord, shortWord,
  g.text({ minSize: 0, maxSize: 24, alphabet: 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }),
  g.sampledFrom(['hello 🙂', 'مرحبا بالعالم', 'e\u0301lan']),
)
const emailValue = g.sampledFrom(['person@example.com', 'hello+test@example.co', 'anta@example.design'])
const urlValue = g.sampledFrom(['https://anta.design', 'https://example.com/path', 'mailto:hello@example.com'])
const longText = g.oneOf(
  g.text({ minSize: 80, maxSize: 180, alphabet: 'abcdefghijklmnopqrstuvwxyz     ' }),
  g.sampledFrom([
    'A tooltip should reveal this complete sentence only when the surrounding text is genuinely clipped by the available card width.',
    'Unicode pressure: مرحبا بالعالم — hello 🙂 — e\u0301lan — this tail should be far enough away to force truncation in a narrow surface.',
  ]),
)
const booleans = g.booleans()
const sizes = g.sampledFrom(['small', 'medium', 'large'])
const archetypes = g.sampledFrom([
  'focus-gauntlet',
  'modal-labyrinth',
  'truncation-chamber',
  'disabled-minefield',
  'selection-maze',
  'copy-workbench',
  'mixed-composition',
])

function treeGenerator() {
  return g.composite((tc) => {
    let nextId = 1
    let nextDialog = 1
    const id = () => `n${nextId++}`
    const label = () => tc.draw(nonEmptyLabel)
    const text = () => tc.draw(editableText)
    const paragraph = () => tc.draw(longText)
    const bool = () => tc.draw(booleans)
    const size = () => tc.draw(sizes)

    const make = (type, props = {}, options = {}) => ({
      id: options.id ?? id(),
      type,
      props,
      ...(options.text === undefined ? {} : { text: options.text }),
      ...(options.children?.length ? { children: options.children } : {}),
      ...(options.propNodes && Object.keys(options.propNodes).length ? { propNodes: options.propNodes } : {}),
    })

    const tooltip = (content = label(), props = {}) =>
      make('Tooltip', { delay: 50, ...props }, { text: content })

    const button = (props = {}, children = []) =>
      make('Button', { label: label(), size: size(), ...props }, { children })

    const copyButton = (props = {}, children = []) =>
      make('ButtonCopy', { label: label(), copy: text(), size: size(), ...props }, { children })

    const input = (props = {}, propNodes, children = []) => {
      const multiline = props.multiline === true || props.rows != null
      const defaultValue = props.defaultValue ?? (multiline
        ? text()
        : props.type === 'email'
          ? tc.draw(emailValue)
          : props.type === 'url'
            ? tc.draw(urlValue)
            : tc.draw(singleLineInputText))
      return make('Input', {
        label: label(),
        defaultValue,
        placeholder: label(),
        clearable: bool(),
        size: size(),
        ...props,
      }, { propNodes, children })
    }

    const checkbox = (props = {}) =>
      make('Checkbox', { label: label(), defaultChecked: bool(), size: size(), ...props })

    const radio = (props = {}) => {
      const nodeId = id()
      const count = tc.draw(g.integers({ minValue: 2, maxValue: 4 }))
      const labels = tc.draw(g.arrays(nonEmptyLabel, { minSize: count, maxSize: count }))
      const options = labels.map((optionLabel, index) => ({
        value: `${nodeId}-radio-${index + 1}`,
        label: optionLabel,
        'data-testid': `${nodeId}-option-${index + 1}`,
        ...(index === 1 && bool() ? { disabled: true } : {}),
      }))
      return make('RadioGroup', {
        label: label(),
        options,
        defaultValue: tc.draw(g.sampledFrom(options)).value,
        orientation: bool() ? 'horizontal' : 'vertical',
        ...props,
      }, { id: nodeId })
    }

    const tabs = (panelFactories, props = {}) => {
      const nodeId = id()
      const count = panelFactories.length
      const options = Array.from({ length: count }, (_, index) => ({
        value: `${nodeId}-tab-${index + 1}`,
        label: index === count - 1 && bool() ? paragraph() : label(),
        'data-testid': `${nodeId}-option-${index + 1}`,
        ...(index === 1 && bool() ? { disabled: true } : {}),
        ...(index === count - 1 && bool() ? { tooltip: paragraph() } : {}),
      }))
      const selected = tc.draw(g.sampledFrom(options)).value
      const panels = options.map((option, index) => make(
        'TabPanel',
        { value: option.value, hideMode: bool() ? 'display' : 'visibility' },
        { children: panelFactories[index]() },
      ))
      return make('Tabs', {
        label: label(),
        options,
        defaultValue: selected,
        orientation: bool() ? 'horizontal' : 'vertical',
        priority: tc.draw(g.sampledFrom(['primary', 'secondary', 'tertiary'])),
        ...props,
      }, { id: nodeId, children: panels })
    }

    const dialogPair = (body, footer = []) => {
      const name = `dialog-${nextDialog++}`
      const trigger = button({ label: `Open ${label()}`, 'data-dialog-open': name })
      const closeAction = button({ label: `Close ${label()}`, 'data-dialog-close': name })
      const header = make('Text', { priority: 'primary' }, { text: label() })
      const dialog = make('Dialog', {
        name,
        closable: bool(),
        persistent: bool(),
        position: tc.draw(g.sampledFrom(['center', 'left', 'right', 'bottom'])),
      }, {
        children: body,
        propNodes: { header: [header], footer: [...footer, closeAction] },
      })
      return [trigger, dialog]
    }

    const focusGauntlet = () => {
      const trailingCopy = copyButton({ label: `Copy ${label()}`, iconPlacement: 'trailing' }, [tooltip()])
      const field = input(
        { clearable: true, hint: label() },
        { trailing: [trailingCopy] },
        [tooltip(`Field help: ${label()}`)],
      )
      const strip = tabs([
        () => [input({ clearable: true })],
        () => [checkbox()],
        () => [copyButton()],
      ])
      return make('Card', { header: label(), style: { maxWidth: '680px' } }, {
        children: [field, checkbox(), radio(), strip],
        propNodes: {
          footer: [
            button({ disabled: true }),
            button({ loading: true }),
            button({}, [tooltip()]),
          ],
        },
      })
    }

    const modalLabyrinth = () => {
      const strip = tabs([
        () => [input({ clearable: true }, undefined, [tooltip()]), checkbox()],
        () => [make('Card', { header: label() }, { children: [radio()] })],
        () => [copyButton({ iconPlacement: bool() ? 'none' : 'leading' })],
      ])
      const pair = dialogPair([strip], [copyButton(), button({ disabled: true })])
      return make('Card', { header: label() }, { children: pair })
    }

    const truncationChamber = () => {
      const automatic = make('Text', {
        truncate: tc.draw(g.integers({ minValue: 1, maxValue: 3 })),
        style: { maxWidth: '190px' },
      }, { text: paragraph() })
      const expandable = make('Text', {
        truncate: tc.draw(g.integers({ minValue: 1, maxValue: 3 })),
        expandable: true,
        collapsible: bool(),
        style: { maxWidth: '190px' },
      }, { text: paragraph() })
      const explicit = make('Text', { truncate: 1, style: { maxWidth: '160px' } }, {
        text: paragraph(),
        children: [tooltip(`Explicit: ${paragraph()}`)],
      })
      const strip = tabs([
        () => [automatic],
        () => [expandable],
        () => [explicit],
      ], { style: { maxWidth: '300px' } })
      return make('Card', { header: label(), style: { width: 'min(100%, 340px)' } }, {
        children: [strip, button({ label: paragraph() }, [tooltip(paragraph(), { truncatedOnly: true })])],
      })
    }

    const disabledMinefield = () => {
      const disabledRadio = radio()
      disabledRadio.props.options[0].disabled = true
      disabledRadio.props.defaultValue = disabledRadio.props.options[0].value
      const disabledTabs = tabs([
        () => [input()],
        () => [checkbox()],
        () => [button()],
      ])
      disabledTabs.props.options[0].disabled = true
      disabledTabs.props.defaultValue = disabledTabs.props.options[0].value
      const loadingCard = make('Card', {
        header: label(),
        href: '#loading-card',
        loading: true,
      }, { text: paragraph() })
      return make('Card', { header: label() }, {
        children: [
          button({ disabled: true }),
          button({ loading: true }),
          copyButton({ disabled: true }),
          copyButton({ loading: true }),
          input({ disabled: true, clearable: true }),
          checkbox({ disabled: true }),
          disabledRadio,
          disabledTabs,
          loadingCard,
          button(),
        ],
      })
    }

    const selectionMaze = () => {
      const strip = tabs([
        () => [input({ clearable: true }), checkbox()],
        () => [radio(), input({ type: 'password', clearable: true })],
        () => [checkbox({ defaultChecked: 'indeterminate' }), copyButton()],
      ])
      return make('Card', { header: label() }, { children: [checkbox(), radio(), strip] })
    }

    const copyWorkbench = () => {
      const trailing = copyButton({ label: `Copy ${label()}`, iconPlacement: 'trailing' })
      return make('Card', { header: label(), 'data-copy-source': '' }, {
        children: [
          copyButton({ iconPlacement: 'leading' }, [tooltip()]),
          copyButton({ iconPlacement: 'none', copiedLabel: `Copied ${label()}` }),
          make('ButtonCopy', { label: `Copy URL ${label()}`, copyUrl: true, iconPlacement: 'trailing' }),
          input({ clearable: true }, { trailing: [trailing] }, [tooltip()]),
        ],
        propNodes: { footer: [copyButton(), button()] },
      })
    }

    const mixedComposition = () => {
      const fieldType = tc.draw(g.sampledFrom(['text', 'email', 'password', 'tel', 'url']))
      const field = input({ type: fieldType, multiline: bool(), clearable: true }, {
        trailing: [copyButton({ label: `Copy ${label()}` })],
      }, [tooltip()])
      const body = [field, checkbox(), radio(), button({}, [tooltip()])]
      if (bool()) body.push(...dialogPair([input(), checkbox()], [copyButton()]))
      return make('Card', { header: label(), selected: bool(), priority: tc.draw(g.sampledFrom(['primary', 'secondary', 'tertiary'])) }, {
        children: body,
        propNodes: { footer: [button(), copyButton()] },
      })
    }

    const archetype = tc.draw(archetypes)
    const builders = {
      'focus-gauntlet': focusGauntlet,
      'modal-labyrinth': modalLabyrinth,
      'truncation-chamber': truncationChamber,
      'disabled-minefield': disabledMinefield,
      'selection-maze': selectionMaze,
      'copy-workbench': copyWorkbench,
      'mixed-composition': mixedComposition,
    }
    return { archetype, root: builders[archetype]() }
  })
}

const scenarios = []
hegel.test((tc) => {
  const generated = tc.draw(treeGenerator())
  scenarios.push(JSON.parse(JSON.stringify({ index: scenarios.length, ...generated })))
}, {
  testCases: 100,
  seed: SEED,
  database: hegel.Database.disabled,
})

const shapeOf = (node) => {
  const children = (node.children ?? []).map(shapeOf).join(',')
  const slots = Object.entries(node.propNodes ?? {})
    .map(([name, nodes]) => `${name}:${nodes.map(shapeOf).join(',')}`)
    .join('|')
  return `${node.type}(${children})[${slots}]`
}
const buckets = new Map()
for (const scenario of scenarios) {
  const shape = `${scenario.archetype}:${shapeOf(scenario.root)}`
  const bucket = buckets.get(shape) ?? []
  bucket.push(scenario)
  buckets.set(shape, bucket)
}
const ordered = []
let previousArchetype = null
while (ordered.length < scenarios.length) {
  const choices = [...buckets.entries()]
    .filter(([, bucket]) => bucket.length && bucket[0].archetype !== previousArchetype)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const [, bucket] = choices[0] ?? [...buckets.entries()].find(([, entries]) => entries.length)
  const scenario = bucket.shift()
  ordered.push({ ...scenario, index: ordered.length })
  previousArchetype = scenario.archetype
}

const corpus = { runId, seed: SEED, scenarios: ordered }
fs.mkdirSync(path.dirname(corpusPath), { recursive: true })
fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`)
console.log(`wrote ${ordered.length} deterministic scenarios (seed ${SEED}) to ${path.relative(process.cwd(), corpusPath)}`)

import { Button } from '@antadesign/anta'
import { useEffect, useRef, useState } from 'preact/hooks'
import styles from './CompositionCampaign.module.css'

type Draw = {
  pick<T>(values: T[]): T
}

type ComponentDefinition = {
  children: 'any' | 'menu' | 'menuGroup' | 'none' | 'text'
  name: string
  props: string
}

type CompositionNode = {
  children: CompositionNode[]
  name: string
}

type CompositionTree = {
  kind: 'screen'
  roots: CompositionNode[]
  settings: {
    maxChildren: number
    maxDepth: number
    nodeBudget: number
  }
}

const fixedOptions = "[{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }]"
const fixedFacets = "[{ key: 'status', label: 'Status', kind: 'multiple', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] }]"
const tabOptions = "[{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }]"
const stepOptions = "[{ value: 'first', label: 'First', state: 'completed' }, { value: 'second', label: 'Second', state: 'incomplete' }]"

const componentManifest: ComponentDefinition[] = [
  { name: 'Avatar', children: 'none', props: 'seed="tree-avatar" name="Tree user"' },
  { name: 'Progress', children: 'none', props: 'value={42} label="Importing" hint="2 of 5"' },
  { name: 'Loader', children: 'none', props: 'label="Loading"' },
  { name: 'Text', children: 'any', props: 'size="small"' },
  { name: 'Title', children: 'any', props: 'level={3}' },
  { name: 'Tag', children: 'any', props: 'tone="info" label="Status"' },
  { name: 'Icon', children: 'none', props: 'shape="check" label="Complete"' },
  { name: 'Button', children: 'text', props: 'priority="secondary"' },
  { name: 'ButtonCopy', children: 'text', props: 'copy="Anta composition fixture" label="Copy"' },
  { name: 'Breadcrumbs', children: 'none', props: "items={[{ label: 'Workspace' }, { label: 'Project' }]}" },
  { name: 'Tooltip', children: 'any', props: '' },
  { name: 'Checkbox', children: 'none', props: 'label="Enabled" defaultChecked' },
  { name: 'Switch', children: 'none', props: 'label="Allow updates" defaultChecked' },
  { name: 'Menu', children: 'menu', props: '' },
  { name: 'MenuItem', children: 'none', props: 'label="Generated action"' },
  { name: 'MenuItemCopy', children: 'none', props: 'copy="Anta composition fixture" label="Copy value"' },
  { name: 'MenuSeparator', children: 'none', props: '' },
  { name: 'MenuGroup', children: 'menuGroup', props: 'label="Generated group"' },
  { name: 'Expander', children: 'any', props: 'title="More options" defaultOpen' },
  { name: 'Input', children: 'none', props: 'label="Name" defaultValue="Anta"' },
  { name: 'Slider', children: 'none', props: 'label="Volume" min={0} max={10} step={1} defaultValue={5}' },
  { name: 'Calendar', children: 'none', props: 'defaultValue="2026-06-15" locale="en-US"' },
  { name: 'InputDate', children: 'none', props: 'label="Review date" defaultValue="2026-06-15" min="2026-06-01" max="2026-06-30" locale="en-US"' },
  { name: 'InputTime', children: 'none', props: 'label="Review time" defaultValue="09:30"' },
  { name: 'InputAutocomplete', children: 'none', props: "label=\"Project\" suggestions={['Anta', 'Bombadil', 'Hegel']} defaultValue=\"Anta\"" },
  { name: 'RadioGroup', children: 'none', props: `label="Density" defaultValue="first" options={${fixedOptions}}` },
  { name: 'Select', children: 'none', props: `label="Environment" defaultValue="first" options={${fixedOptions}}` },
  { name: 'SelectFaceted', children: 'none', props: `label="Filters" facets={${fixedFacets}}` },
  { name: 'Tabs', children: 'any', props: `label="Generated tabs" defaultValue="first" options={${tabOptions}}` },
  { name: 'Steps', children: 'any', props: `defaultValue="first" options={${stepOptions}}` },
  { name: 'TabPanel', children: 'any', props: 'value="first"' },
  { name: 'Dialog', children: 'any', props: 'header="Generated dialog"' },
  { name: 'Card', children: 'any', props: 'header="Generated card"' },
  { name: 'Banner', children: 'any', props: 'tone="info" message="Generated notice"' },
  { name: 'Toaster', children: 'none', props: 'label="Generated notifications"' },
]

const componentsByName = new Map(componentManifest.map((component) => [component.name, component]))
const menuChildNames = ['MenuItem', 'MenuItemCopy', 'MenuSeparator', 'MenuGroup']
const menuGroupChildNames = ['MenuItem', 'MenuItemCopy']
const menuOnlyNames = new Set([...menuChildNames])
const generalNames = componentManifest
  .filter((component) => !menuOnlyNames.has(component.name))
  .map((component) => component.name)

function terminalNames(names: string[]) {
  return names.filter((name) => {
    const component = componentsByName.get(name)
    return component?.children === 'none' || component?.children === 'text'
  })
}

function pick<T>(draw: Draw, values: T[]) {
  const value = draw.pick(values)
  if (!values.includes(value)) throw new Error('Tree draw chose a value outside its vocabulary.')
  return value
}

function count(draw: Draw, maximum: number) {
  return pick(draw, Array.from({ length: maximum }, (_, index) => index + 1))
}

function generateComposition(draw: Draw, {
  maxDepth = 8,
  maxChildren = 3,
  nodeBudget = 48,
} = {}): CompositionTree {
  for (const [name, value] of Object.entries({ maxDepth, maxChildren, nodeBudget })) {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer.`)
  }

  let remaining = nodeBudget
  function nodes(depth: number, maximum: number, names = generalNames) {
    const result: CompositionNode[] = []
    const requested = count(draw, maximum)
    while (result.length < requested && remaining > 0) result.push(node(depth, names))
    return result
  }

  function node(depth: number, names: string[]): CompositionNode {
    remaining -= 1
    const choices = depth >= maxDepth || remaining <= 0
      ? terminalNames(names)
      : names
    const name = pick(draw, choices)
    const component = componentsByName.get(name)
    if (!component) throw new TypeError(`Unknown component ${name}.`)
    let children: CompositionNode[] = []
    if (depth < maxDepth && remaining > 0) {
      if (component.children === 'any') children = nodes(depth + 1, maxChildren)
      if (component.children === 'menu') children = nodes(depth + 1, maxChildren, menuChildNames)
      if (component.children === 'menuGroup') children = nodes(depth + 1, maxChildren, menuGroupChildNames)
    }
    return { name, children }
  }

  const roots = nodes(1, maxChildren)
  return { kind: 'screen', roots, settings: { maxDepth, maxChildren, nodeBudget } }
}

function treePath(path: string) {
  return `data-tree-path="${path}"`
}

function renderChildren(children: CompositionNode[], path: string) {
  return children.length
    ? children.map((child, index) => renderNode(child, `${path}-${index}`)).join('\n')
    : 'Generated content'
}

function renderNode(node: CompositionNode, path: string): string {
  const component = componentsByName.get(node.name)
  if (!component) throw new TypeError(`Unknown component ${node.name}.`)
  const attributes = [treePath(path), component.props].filter(Boolean).join(' ')
  const children = renderChildren(node.children, path)

  if (component.children === 'none') return `<${node.name} ${attributes} />`

  switch (node.name) {
    case 'Menu':
      return `<div ${treePath(`${path}-wrapper`)}>
  <Button ${treePath(`${path}-trigger`)}>Open menu</Button>
  <Menu ${attributes}>${children}</Menu>
</div>`
    case 'Tabs': case 'Steps':
      return `<${node.name} ${attributes}>
  <TabPanel value="first">${children}</TabPanel>
  <TabPanel value="second"><Text>Second panel</Text></TabPanel>
</${node.name}>`
    case 'Dialog':
      return `<div ${treePath(`${path}-wrapper`)}>
  <Button ${treePath(`${path}-trigger`)} data-dialog-open="${path}">Open dialog</Button>
  <Dialog ${attributes} name="${path}" footer={<Button data-dialog-close="${path}">Close</Button>}>${children}</Dialog>
</div>`
    default:
      return `<${node.name} ${attributes}>${children}</${node.name}>`
  }
}

function renderComposition(tree: CompositionTree) {
  const used = new Set(['Button', 'TabPanel', 'Text'])
  const visit = (node: CompositionNode) => {
    used.add(node.name)
    node.children.forEach(visit)
  }
  tree.roots.forEach(visit)
  return `import { ${[...used].sort().join(', ')} } from '@antadesign/anta'

export default function App() {
  return <main data-composition-root>
${tree.roots.map((node, index) => `    ${renderNode(node, `node-${index}`)}`).join('\n')}
  </main>
}
`
}

type CampaignState = {
  caseId: number
  error: string | null
  status: 'booting' | 'generating' | 'mounting' | 'ready' | 'error'
}

const initialState: CampaignState = { caseId: 0, error: null, status: 'booting' }

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function optionalInteger(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

async function waitForHarness() {
  for (;;) {
    const controller = window.antaHarness
    if (controller) return controller
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

/**
 * The composition campaign creates regular TSX and loads it through the same
 * source API the editor uses. Harness remains unaware of Hegel and Bombadil.
 */
export default function CompositionCampaign() {
  const [state, setState] = useState<CampaignState>(initialState)
  const [requestedCase, setRequestedCase] = useState(0)
  const sources = useRef(new Map<number, string>())

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.get('fuzz_tree') !== 'true') return

    const maxDepth = positiveInteger(query.get('maxDepth'), 8)
    const maxChildren = positiveInteger(query.get('maxChildren'), 3)
    const nodeBudget = positiveInteger(query.get('nodeBudget'), 48)
    const seed = optionalInteger(query.get('seed'))
    let cancelled = false

    const run = async () => {
      await waitForHarness()
      if (cancelled) return
      const [{ test, Database }, generators] = await Promise.all([
        import('@hegeldev/hegel'),
        import('@hegeldev/hegel/generators'),
      ])
      let source = sources.current.get(requestedCase)
      if (!source) {
        setState({ caseId: requestedCase, error: null, status: 'generating' })
        let tree: ReturnType<typeof generateComposition> | null = null
        test((tc) => {
          tree = generateComposition({
            pick(values) {
              return tc.draw(generators.sampledFrom(values))
            },
          }, { maxDepth, maxChildren, nodeBudget })
        }, {
          database: Database.disabled,
          ...(seed == null ? {} : { seed: seed + requestedCase }),
          testCases: 1,
        })
        if (cancelled || !tree) return
        source = renderComposition(tree)
        sources.current.set(requestedCase, source)
      }

      setState({ caseId: requestedCase, error: null, status: 'mounting' })
      const result = await (await waitForHarness()).setSource(source)
      if (cancelled) return
      if (result.status === 'error') {
        setState({ caseId: requestedCase, error: result.error ?? 'The harness could not render the generated TSX.', status: 'error' })
        return
      }

      setState({ caseId: requestedCase, error: null, status: 'ready' })
    }

    void run().catch((error) => {
      if (!cancelled) setState({
        caseId: 0,
        error: error instanceof Error ? error.message : String(error),
        status: 'error',
      })
    })
    return () => { cancelled = true }
  }, [requestedCase])

  if (new URLSearchParams(window.location.search).get('fuzz_tree') !== 'true') return null
  const changingCase = state.status === 'booting' || state.status === 'generating' || state.status === 'mounting'
  return <>
    <output
      hidden
      data-composition-case={state.caseId}
      data-composition-error={state.error ?? undefined}
      data-composition-status={state.status}
    />
    <nav className={styles.controls} aria-label="Generated composition cases">
      <Button
        disabled={requestedCase === 0 || changingCase}
        icon="chevron-left"
        label="Previous"
        priority="secondary"
        onClick={() => setRequestedCase((caseId) => Math.max(0, caseId - 1))}
      />
      <span className={styles.caseNumber} aria-live="polite">Case {requestedCase + 1}</span>
      <Button
        disabled={changingCase}
        iconTrailing="chevron-right"
        label="Next"
        priority="secondary"
        onClick={() => setRequestedCase((caseId) => caseId + 1)}
      />
    </nav>
  </>
}

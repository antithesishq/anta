import { useState } from 'react'
import { Box, Button, Icon, Menu, MenuItem, Text, Tree, type TreeItem } from '@antadesign/anta'

// Demo islands for the Tree page. Tree keeps its open items and its Tab stop
// in the JSX wrapper, so a demo must be hydrated for its items to open.

type Entry = { path: string; name: string; entries?: Entry[] }

const project: Entry[] = [
  { path: 'src', name: 'src', entries: [
    { path: 'src/index.ts', name: 'index.ts' },
    { path: 'src/ledger', name: 'ledger', entries: [
      { path: 'src/ledger/transfer.ts', name: 'transfer.ts' },
      { path: 'src/ledger/balance.ts', name: 'balance.ts' },
    ] },
    { path: 'src/fixtures', name: 'fixtures', entries: [] },
  ] },
  { path: 'workload', name: 'workload', entries: [{ path: 'workload/driver.ts', name: 'driver.ts' }] },
  { path: 'README.md', name: 'README.md' },
]

const folderIcons = { closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> }

/** A folder tree: folder and file icons, and files that open when selected. */
export function FolderDemo() {
  const [opened, setOpened] = useState<string | null>(null)
  const toItems = (entries: Entry[]): TreeItem[] => entries.map(entry => ({
    id: entry.path,
    label: entry.name,
    children: entry.entries && toItems(entry.entries),
    indicator: entry.entries ? undefined : <Icon shape="file" />,
    onClick: entry.entries ? undefined : () => setOpened(entry.path),
  }))
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Tree aria-label="Project files" items={toItems(project)} defaultOpen={['src']} indicator={folderIcons} />
      <Text size="small">Opened: {opened ?? 'nothing yet'}</Text>
    </Box>
  )
}

const checks: TreeItem[] = [
  { id: 'safety', label: 'Safety properties', children: [
    { id: 'safety/ledger', label: 'Ledger total is conserved' },
    { id: 'safety/negative', label: 'No account goes negative' },
  ] },
  { id: 'liveness', label: 'Liveness properties', children: [
    { id: 'liveness/leader', label: 'Leader is elected after a partition heals' },
  ] },
]

/** The same items with each built-in mark, and one at the end of its row. */
export function IndicatorDemo() {
  return (
    <Box display="grid" gap={16} style={{ width: '100%' }}>
      <Tree aria-label="Chevron" items={checks} defaultOpen={['safety']} />
      <Tree aria-label="Triangle" items={checks} defaultOpen={['safety']} indicator="triangle" />
      <Tree aria-label="Plus at the end" items={checks} defaultOpen={['safety']} indicator="plus" indicatorPlacement="end" />
    </Box>
  )
}

/** Row actions, and a context menu for any row. */
export function ActionsDemo() {
  const [menuItem, setMenuItem] = useState<string | null>(null)
  const [log, setLog] = useState('Select an action.')
  const toItems = (entries: Entry[]): TreeItem[] => entries.map(entry => ({
    id: entry.path,
    label: entry.name,
    children: entry.entries && toItems(entry.entries),
    indicator: entry.entries ? undefined : <Icon shape="file" />,
    // Two actions on every row, pinned to the row's end.
    actions: [
      entry.entries
        ? { icon: 'plus' as const, label: 'New file', tooltip: 'New file', onClick: () => setLog(`New file in ${entry.path}`) }
        : { icon: 'copy' as const, label: 'Copy path', tooltip: 'Copy path', onClick: () => setLog(`Copied ${entry.path}`) },
      { icon: 'more' as const, label: 'More actions', opensMenu: true },
    ],
  }))
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Tree aria-label="Project files" items={toItems(project)} defaultOpen={['src']} indicator={folderIcons} onItemMenu={(_event, { id }) => setMenuItem(id)} />
      <Menu context>
        <MenuItem label="Rename" disabled={menuItem === null} onSelect={() => setLog(`Rename ${menuItem}`)} />
        <MenuItem label="Delete" tone="critical" disabled={menuItem === null} onSelect={() => setLog(`Delete ${menuItem}`)} />
      </Menu>
      <Text size="small">{log}</Text>
    </Box>
  )
}

const services: TreeItem[] = [
  { id: 'api', label: 'api', children: [{ id: 'api/1', label: 'api-1' }, { id: 'api/2', label: 'api-2' }] },
  { id: 'db', label: 'db', children: [{ id: 'db/1', label: 'db-1' }] },
]
const withActions = (items: TreeItem[], log: (text: string) => void): TreeItem[] => items.map(item => ({
  ...item,
  children: item.children && withActions(item.children, log),
  actions: [
    { icon: 'refresh' as const, label: `Restart ${item.label}`, onClick: () => log(`Restart ${item.label}`) },
    { icon: 'copy' as const, label: `Copy ${item.label}`, onClick: () => log(`Copied ${item.label}`) },
  ],
}))

/** Actions at the row's end, the default, and right after the label with `--tree-actions-align: start`. */
export function ActionsAlignDemo() {
  const [log, setLog] = useState('Select an action.')
  const items = withActions(services, setLog)
  return (
    <Box display="grid" gap={16} style={{ width: '100%' }}>
      <Box display="grid" gap={4}>
        <Text size="small">At the end (default)</Text>
        <Tree aria-label="Services, actions at the end" items={items} defaultOpen={['api']} />
      </Box>
      <Box display="grid" gap={4}>
        <Text size="small">After the label (--tree-actions-align: start)</Text>
        <Tree className="tree-actions-start" aria-label="Services, actions after the label" items={items} defaultOpen={['api']} />
      </Box>
      <Text size="small">{log}</Text>
    </Box>
  )
}

// A stand-in for a server: each folder's children arrive after a short delay.
function fetchChildren(path: string): Promise<Entry[]> {
  return new Promise(resolve => setTimeout(() => resolve(
    Array.from({ length: 3 }, (_, i) => ({ path: `${path}/${i + 1}`, name: `run ${i + 1}`, entries: [] })),
  ), 400))
}

/** Controlled open state, with children loaded when a folder first opens. */
export function ControlledDemo() {
  const [open, setOpen] = useState<string[]>([])
  const [loaded, setLoaded] = useState<Record<string, Entry[]>>({})
  const roots: Entry[] = [{ path: 'nightly', name: 'nightly', entries: [] }, { path: 'weekly', name: 'weekly', entries: [] }]
  const toItems = (entries: Entry[]): TreeItem[] => entries.map(entry => ({
    id: entry.path,
    label: open.includes(entry.path) && !loaded[entry.path] ? `${entry.name} (loading)` : entry.name,
    children: toItems(loaded[entry.path] ?? []),
  }))
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Box display="flex" gap={8}>
        <Button size="small" label="Close all" onClick={() => setOpen([])} />
      </Box>
      <Tree
        aria-label="Test runs"
        items={toItems(roots)}
        open={open}
        onStateChange={(_event, { next }) => {
          setOpen(next)
          for (const id of next) {
            if (loaded[id]) continue
            fetchChildren(id).then(children => setLoaded(current => ({ ...current, [id]: children })))
          }
        }}
      />
    </Box>
  )
}

/** Items for the styling recipes. */
export function StylingDemo({ className }: { className?: string }) {
  return <Tree className={className} aria-label="Checks" items={checks} defaultOpen={['safety', 'liveness']} />
}

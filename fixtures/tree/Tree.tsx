import { useLayoutEffect, useState } from 'react'
import { Icon, Menu, MenuItem, Tree as AntaTree, type TreeItem } from '@antadesign/anta'

export type TreeFixtureProps = {
  id: string
  controlled: boolean
  indicatorPlacement: 'start' | 'end'
  folderIcons: boolean
}

declare global {
  interface Window {
    __antaTree?: Omit<TreeFixtureProps, 'id'> & { id: string }
  }
}

type Entry = { path: string; name: string; entries?: Entry[]; disabled?: boolean }

// A small project: nested folders, an empty folder, a disabled folder, and
// files at several depths.
const files: Entry[] = [
  { path: 'src', name: 'src', entries: [
    { path: 'src/index.ts', name: 'index.ts' },
    { path: 'src/lib', name: 'lib', entries: [
      { path: 'src/lib/util.ts', name: 'util.ts' },
      { path: 'src/lib/deep', name: 'deep', entries: [{ path: 'src/lib/deep/a.ts', name: 'a.ts' }] },
    ] },
    { path: 'src/empty', name: 'empty', entries: [] },
    { path: 'src/vendor', name: 'vendor', disabled: true, entries: [{ path: 'src/vendor/x.js', name: 'x.js' }] },
  ] },
  { path: 'docs', name: 'docs', entries: [{ path: 'docs/guide.md', name: 'guide.md' }] },
  { path: 'README.md', name: 'README.md' },
]

// The folder tree from the Tree docs, built from the public API alone.
export function Tree({ id, controlled, indicatorPlacement, folderIcons }: TreeFixtureProps) {
  const [open, setOpen] = useState<string[]>(['src'])
  const [menuItem, setMenuItem] = useState<string | null>(null)
  const [opened, setOpened] = useState<string | null>(null)

  useLayoutEffect(() => {
    window.__antaTree = { id, controlled, indicatorPlacement, folderIcons }
    return () => { delete window.__antaTree }
  }, [id, controlled, indicatorPlacement, folderIcons])

  const toItems = (entries: Entry[]): TreeItem[] => entries.map(entry => ({
    id: entry.path,
    label: entry.name,
    children: entry.entries && toItems(entry.entries),
    disabled: entry.disabled,
    indicator: entry.entries ? undefined : <Icon shape="file" />,
    actions: entry.entries
      ? [{ icon: 'file', label: 'New file' }, { icon: 'more', label: 'More actions', opensMenu: true }]
      : undefined,
    onClick: entry.entries ? undefined : () => setOpened(entry.path),
  }))

  return (
    <div data-tree-fixture data-opened={opened ?? undefined}>
      <AntaTree
        id={id}
        aria-label="Files"
        items={toItems(files)}
        {...(controlled
          ? { open, onStateChange: (_event: CustomEvent, { next }: { next: string[] }) => setOpen(next) }
          : { defaultOpen: ['src'] })}
        indicator={folderIcons ? { closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> } : 'chevron'}
        indicatorPlacement={indicatorPlacement}
        onItemMenu={(_event, { id: item }) => setMenuItem(item)}
      />
      <Menu context>
        <MenuItem label={`Rename ${menuItem ?? '…'}`} />
      </Menu>
    </div>
  )
}

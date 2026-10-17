import { normalizeOpt } from './select-options'
import type { OptionValue, SelectGroup, SelectItem, SelectOption, SelectSubmenu } from './Select'

interface Leaf<V extends OptionValue> {
  kind: 'option'
  opt: SelectOption<V>
  disabled: boolean
  group?: string
}

export type SelectNode<V extends OptionValue> = Leaf<V> | (
  { key: string; disabled: boolean; children: SelectNode<V>[] } & (
    | { kind: 'group'; source: SelectGroup<V> }
    | { kind: 'submenu'; source: SelectSubmenu<V> }
  )
)

// Select keeps its hierarchy until a query flattens it. SelectFaceted has a
// separate flat, per-facet model; only primitive normalization is shared.
export function prepareSelectOptions<V extends OptionValue>(
  items: SelectItem<V>[],
  matches?: (option: SelectOption<V>) => boolean,
) {
  const allLeaves: Leaf<V>[] = []
  const visibleLeaves: Leaf<V>[] = []

  const walk = (items: SelectItem<V>[], group?: string, disabled = false): SelectNode<V>[] => {
    const nodes: SelectNode<V>[] = []
    items.forEach((raw, index) => {
      if (typeof raw !== 'string' && Array.isArray((raw as SelectSubmenu<V>).submenu)) {
        const source = raw as SelectSubmenu<V>
        const effectiveDisabled = disabled || !!source.disabled
        const children = walk(source.submenu, source.label, effectiveDisabled)
        if (children.length) nodes.push({ kind: 'submenu', source, disabled: effectiveDisabled, children, key: `sub-${index}-${source.label}` })
      } else if (typeof raw !== 'string' && Array.isArray((raw as SelectGroup<V>).options)) {
        const source = raw as SelectGroup<V>
        const effectiveDisabled = disabled || !!source.disabled
        const children = walk(source.options, source.label, effectiveDisabled)
        if (children.length) nodes.push({ kind: 'group', source, disabled: effectiveDisabled, children, key: `grp-${index}-${source.label}` })
      } else {
        const opt = normalizeOpt(raw as string | SelectOption<V>)
        const leaf: Leaf<V> = { kind: 'option', opt, disabled: disabled || !!opt.disabled, group }
        allLeaves.push(leaf)
        if (!matches || matches(opt)) {
          visibleLeaves.push(leaf)
          nodes.push(leaf)
        }
      }
    })
    return nodes
  }

  const tree = walk(items)
  return { tree, allLeaves, visibleLeaves }
}

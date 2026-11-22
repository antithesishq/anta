// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import. Tree renders every item from `items` data, as Tabs
// renders from `options`, so it never inspects children and keeps the roving Tab
// stop private. The `a-tree` element handles every click and key and writes no
// DOM; this wrapper renders what it reports. See src/elements/a-tree.ts.
import { nativeStateChange, optionPresentationAttrs } from "../anta_helpers"
import type { ATreeItemAttributes, BaseProps, OptionPresentationProps } from "../general_types"
import type { IconShape } from "../elements/a-icon.shapes"
import { useId, useMemo, useRef, useState } from "../jsx-runtime"
import { useNativeEventProps } from "../native-event-props"
import { Button } from "./Button"
import { Tooltip } from "./Tooltip"

/** One item in a `<Tree>`, as plain data. Tree renders every row from these. */
export interface TreeItem extends OptionPresentationProps {
  /** The item's identity, unique in the tree. `open`, `defaultOpen` and
   *  `onStateChange` speak in these ids. */
  id: string
  /** The row's content. A string gets the default styling; a node is rendered
   *  as given. The Tree's `renderLabel` overrides both. */
  label: React.ReactNode
  /** Child items. Defined means the item can open, even when empty: pass `[]`
   *  for children that aren't loaded yet, as for a closed item whose children
   *  you only compute once it opens. Leave it out for a leaf. */
  children?: TreeItem[]
  /** This item's mark, overriding the Tree's `indicator`. On a leaf, only a
   *  node renders (a file icon, say); a leaf without one keeps the mark's
   *  space, so labels line up. */
  indicator?: TreeIndicator
  /** Shown on the row after the label while the item is open, such as an
   *  opening bracket. */
  before?: React.ReactNode
  /** Shown on its own line below the children while the item is open, such as
   *  a closing bracket. It isn't a tree item: it can't take focus, and screen
   *  readers skip it. */
  after?: React.ReactNode
  /** Buttons at the end of the row, in their own container. They show on hover
   *  and on the focused row. Right from the row reaches the first one; they're
   *  never Tab stops. */
  actions?: TreeAction[]
  /** Selecting a leaf, by click, Enter, or Space. An item that can open opens
   *  instead. */
  onClick?: (event: Event) => void
  /** Can't open or be selected; still focusable, as a disabled tab is. */
  disabled?: boolean
}

/** A button in a row's actions. */
export interface TreeAction {
  /** The button's icon. */
  icon: IconShape
  /** Accessible name, announced by screen readers. */
  label: string
  /** Tooltip shown on hover and focus. Leave it out for none. */
  tooltip?: React.ReactNode
  /** Pressing the button, by pointer, Enter, or Space. It doesn't open or
   *  close the row. */
  onClick?: (event: Event) => void
  /** Opens the `<Menu context>` that follows the Tree, at this button, for this
   *  item: `onItemMenu` fires, then the menu opens. */
  opensMenu?: boolean
  /** Shows the button but can't be pressed, and the arrow keys skip it. */
  disabled?: boolean
}

/** An item's open/closed mark: a built-in shape, any node, or a node for each
 *  state. The same values as Expander's `indicator`. */
export type TreeIndicator =
  | "chevron" | "triangle" | "plus"
  | React.ReactNode
  | { closed: React.ReactNode; open: React.ReactNode }

/** What `renderLabel` and `renderIndicator` know about an item. */
export interface TreeItemState {
  /** The item is open. Always false for a leaf. */
  open: boolean
  /** 0 for top-level items. */
  depth: number
}

/** Public props for `<Tree>`. */
export interface TreeProps extends Omit<BaseProps, "children"> {
  /** The items, as data: the tree's single source. */
  items: TreeItem[]
  /** Controlled open items, by id. When set, you own open and close: the tree
   *  shows exactly this, and a click or key only requests a change through
   *  `onStateChange`. `[]` is controlled with nothing open. Leave it undefined
   *  (and use `defaultOpen`) for uncontrolled. */
  open?: string[]
  /** Items open on first render, uncontrolled. After that the Tree owns open
   *  and close itself. */
  defaultOpen?: string[]
  /** Fired before items open or close. `detail.next` is the requested list of
   *  open ids and `detail.prev` the current one. `scope` is `'subtree'` for
   *  Alt+click and Alt+Enter, which open or close the item and everything
   *  under it, and `'item'` otherwise. An uncontrolled Tree applies a subtree
   *  request to the `items` it has; a controlled caller with children it hasn't
   *  loaded yet works out the rest. `event.preventDefault()` vetoes an
   *  uncontrolled change; in controlled mode, apply `next` to `open` to accept. */
  onStateChange?: (
    event: CustomEvent,
    detail: { next: string[]; prev: string[]; scope: "item" | "subtree" },
  ) => void
  /** The open/closed mark for every item that can open.
   *  @defaultValue 'chevron' */
  indicator?: TreeIndicator
  /** Put the mark before the label or after it.
   *  @defaultValue 'start' */
  indicatorPlacement?: "start" | "end"
  /** Replaces each row's label. The actions keep their own container, so this
   *  never renders them. */
  renderLabel?: (item: TreeItem, state: TreeItemState) => React.ReactNode
  /** Replaces each row's mark. */
  renderIndicator?: (item: TreeItem, state: TreeItemState) => React.ReactNode
  /** Fired when a context menu opens on an item: a right-click, Shift+F10, the
   *  Menu key, or an action with `opensMenu`. `detail.id` is that item. Put your
   *  own `<Menu context>` right after the Tree: it opens by itself, since a root
   *  Menu's trigger region is the element before it. From a worker, the menu
   *  can open before this reaches you, so render its items for "no item yet"
   *  until it does. */
  onItemMenu?: (event: CustomEvent, detail: { id: string }) => void
  /** Moves focus to an item and scrolls it into view. A new `n` repeats the
   *  request, so the same item can be focused again. The first render never
   *  focuses; only a change does. The item must be shown: every ancestor open. */
  focusRequest?: { id: string; n: number }
  /** The current item, such as a search match: it's marked `data-current` and
   *  scrolled into view after rendering, without moving focus or the keyboard's
   *  cursor. The first render doesn't scroll; only a change does. */
  current?: string
  /** Content shown before the tree, outside it, such as a search field. */
  toolbar?: React.ReactNode
  /** Accessible name. Give every tree one. */
  "aria-label"?: string
}

type ElementEvent<D> = CustomEvent<D> | { nativeEvent: CustomEvent<D> }
type ItemStateDetail = { next: "open" | "closed"; prev: "open" | "closed"; scope: "item" | "subtree" }
const PRESETS = new Set(["chevron", "triangle", "plus"])
const NO_IDS: string[] = []
// Each duplicate id warns once, not on every render.
const warnedDuplicateIds = new Set<string>()

// One `<a-tree-item>`, so its listeners pass through the shared hydration gate.
const TreeItemElement = ({ onstatechange, onactivate, ...props }: ATreeItemAttributes) => {
  const events = useNativeEventProps({ onstatechange, onactivate })
  return <a-tree-item {...props} {...events} />
}

const isPaired = (indicator: TreeIndicator): indicator is { closed: React.ReactNode; open: React.ReactNode } =>
  indicator != null && typeof indicator === "object" && "closed" in indicator && "open" in indicator

// Ids of an item and every item under it that can open and isn't disabled.
function subtreeIds(item: TreeItem, into: string[] = []): string[] {
  if (item.children === undefined || item.disabled) return into
  into.push(item.id)
  for (const child of item.children) subtreeIds(child, into)
  return into
}

/**
 * A tree of items that open and close, from a folder browser to a value
 * inspector. Every row is rendered from `items`. Select a row, or use the arrow
 * keys, to open it. Rows can carry actions, and a `<Menu context>` placed right
 * after the Tree becomes its context menu.
 *
 * Open state follows the usual contract: controlled `open` with `onStateChange`,
 * or uncontrolled `defaultOpen`. The tree is one Tab stop.
 *
 * @example
 * ```tsx
 * <Tree
 *   aria-label="Files"
 *   defaultOpen={["src"]}
 *   indicator={{ closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> }}
 *   items={[{ id: "src", label: "src", children: [{ id: "src/index.ts", label: "index.ts" }] }]}
 * />
 * ```
 */
export const Tree = ({
  items,
  open,
  defaultOpen,
  onStateChange,
  indicator = "chevron",
  indicatorPlacement = "start",
  renderLabel,
  renderIndicator,
  onItemMenu,
  focusRequest,
  current,
  toolbar,
  className,
  style,
  ...rest
}: TreeProps) => {
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState<string[]>(() => defaultOpen ?? NO_IDS)
  const openIds = controlled ? open : internalOpen
  const openSet = useMemo(() => new Set(openIds), [openIds])
  // The roving Tab stop, kept current from the element's `navigate`.
  const [active, setActive] = useState<string | null>(null)
  // The first render never focuses, so only a later request reaches the element.
  const [initialFocus] = useState(() => focusRequest && `${focusRequest.id}#${focusRequest.n}`)
  const focusSignal = focusRequest && `${focusRequest.id}#${focusRequest.n}`
  // Each new `current` is a new scroll request; the first render's is skipped.
  // A ref, not state: a render-phase setState commits the stale count first
  // under Preact, which would change `data-reveal` twice and scroll twice.
  const reveal = useRef<{ id: string | undefined; n: number }>({ id: current, n: 0 })
  if (reveal.current.id !== current) reveal.current = { id: current, n: reveal.current.n + 1 }
  const revealSignal = current !== undefined && reveal.current.n > 0 ? `${current}#${reveal.current.n}` : undefined
  const baseId = useId()

  // Ids are an item's identity, so duplicates make open state ambiguous.
  const seen = new Set<string>()
  const visible: string[] = []
  const walk = (list: TreeItem[], shown: boolean) => {
    for (const item of list) {
      if (seen.has(item.id) && !warnedDuplicateIds.has(item.id)) {
        warnedDuplicateIds.add(item.id)
        console.warn(`[anta] <Tree> duplicate item id=${JSON.stringify(item.id)}: ids must be unique.`)
      }
      seen.add(item.id)
      if (shown) visible.push(item.id)
      if (item.children) walk(item.children, shown && openSet.has(item.id))
    }
  }
  walk(items, true)
  const tabStop = active !== null && visible.includes(active) ? active : visible[0]

  const events = useNativeEventProps({
    onnavigate: (e: ElementEvent<{ id: string }>) => {
      const { detail, isOwn } = nativeStateChange(e)
      if (isOwn && detail) setActive(detail.id)
    },
    onitemmenu: (e: ElementEvent<{ id: string }>) => {
      const { event, detail } = nativeStateChange(e)
      if (detail) onItemMenu?.(event, detail)
    },
  })
  const requestState = (item: TreeItem) => (e: ElementEvent<ItemStateDetail>) => {
    const { event, detail, isOwn } = nativeStateChange(e)
    if (!isOwn || !detail) return
    const opening = detail.next === "open"
    const ids = detail.scope === "subtree" ? subtreeIds(item) : [item.id]
    const prev = openIds
    const next = opening
      ? [...prev, ...ids.filter(id => !openSet.has(id))]
      : prev.filter(id => !ids.includes(id))
    onStateChange?.(event, { next, prev, scope: detail.scope })
    if (controlled || event.defaultPrevented) return
    setInternalOpen(next)
  }

  const indicatorNodes = (item: TreeItem, state: TreeItemState, expandable: boolean) => {
    if (renderIndicator)
      return [<a-tree-indicator key="indicator" aria-hidden="true" inert>{renderIndicator(item, state)}</a-tree-indicator>]
    const own = item.indicator
    const mark = own ?? indicator
    if (!expandable) {
      // A leaf shows only a node of its own; otherwise an empty mark keeps the space.
      const node = own != null && !PRESETS.has(own as string) && !isPaired(own) ? own as React.ReactNode : null
      return [<a-tree-indicator key="indicator" aria-hidden="true" inert>{node}</a-tree-indicator>]
    }
    if (isPaired(mark))
      return [
        <a-tree-indicator key="indicator-closed" data-when="closed" aria-hidden="true" inert>{mark.closed}</a-tree-indicator>,
        <a-tree-indicator key="indicator-open" data-when="open" aria-hidden="true" inert>{mark.open}</a-tree-indicator>,
      ]
    if (typeof mark === "string" && PRESETS.has(mark))
      return [<a-tree-indicator key="indicator" shape={mark as "chevron" | "triangle" | "plus"} aria-hidden="true" inert />]
    return [<a-tree-indicator key="indicator" aria-hidden="true" inert>{mark as React.ReactNode}</a-tree-indicator>]
  }

  const renderItem = (item: TreeItem, depth: number, path: string): React.ReactNode => {
    const expandable = item.children !== undefined
    const isOpen = expandable && openSet.has(item.id)
    const state: TreeItemState = { open: isOpen, depth }
    const valueId = `${baseId}-${path}`
    const { className: itemClassName, style: itemStyle, ...itemAttrs } = optionPresentationAttrs(item)
    const label = renderLabel ? renderLabel(item, state) : item.label
    const value = <a-tree-value key="value" id={valueId}>{label}</a-tree-value>
    const before = isOpen && item.before != null
      ? <a-tree-before key="before" aria-hidden="true">{item.before}</a-tree-before>
      : null
    const actions = item.actions?.length
      ? (
        <a-tree-actions key="actions">
          {item.actions.map((action, i) => (
            <Button
              key={i}
              size="small"
              priority="tertiary"
              icon={action.icon}
              aria-label={action.label}
              aria-haspopup={action.opensMenu ? "menu" : undefined}
              data-opens-menu={action.opensMenu ? "" : undefined}
              tabIndex={-1}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.tooltip != null && <Tooltip>{action.tooltip}</Tooltip>}
            </Button>
          ))}
        </a-tree-actions>
      )
      : null
    const marks = indicatorNodes(item, state, expandable)
    return (
      <TreeItemElement
        key={item.id}
        onstatechange={expandable ? requestState(item) : undefined}
        onactivate={!expandable && item.onClick
          ? (e: ElementEvent<undefined>) => item.onClick?.(nativeStateChange(e).event)
          : undefined}
        {...itemAttrs}
        role="treeitem"
        item-id={item.id}
        state={expandable ? (isOpen ? "open" : "closed") : undefined}
        disabled={item.disabled ? "" : undefined}
        aria-disabled={item.disabled ? "true" : undefined}
        aria-labelledby={valueId}
        data-current={item.id === current ? "" : undefined}
        tabIndex={item.id === tabStop ? 0 : -1}
        class={itemClassName}
        style={itemStyle}
      >
        <a-tree-row>
          {indicatorPlacement === "end"
            ? [value, before, ...marks, actions]
            : [...marks, value, before, actions]}
        </a-tree-row>
        {isOpen && item.children!.length
          ? <a-tree-group role="group">{item.children!.map((child, i) => renderItem(child, depth + 1, `${path}-${i}`))}</a-tree-group>
          : null}
        {isOpen && item.after != null ? <a-tree-after aria-hidden="true">{item.after}</a-tree-after> : null}
      </TreeItemElement>
    )
  }

  const tree = (
    <a-tree
      role="tree"
      data-focus={focusSignal !== initialFocus ? focusSignal : undefined}
      data-reveal={revealSignal}
      {...events}
      class={className}
      style={style}
      {...rest}
    >
      {items.map((item, i) => renderItem(item, 0, String(i)))}
    </a-tree>
  )
  // The toolbar sits before the tree, outside role="tree"; a following
  // `<Menu context>` still has the tree as its trigger.
  return toolbar == null ? tree : <>{<a-tree-toolbar>{toolbar}</a-tree-toolbar>}{tree}</>
}

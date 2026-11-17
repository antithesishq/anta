import { customEventHandler } from "../anta_helpers"
import type { BaseProps } from "../general_types"
import { copyText, describe, rowNode, visibleRows, type InspectNode, type InspectRow, type NodeKind, type Token } from "../inspector-core"
import { useMemo, useState } from "../jsx-runtime"
import { useNativeEventProps } from "../native-event-props"
import { Menu } from "./Menu"
import { MenuItemCopy } from "./MenuItemCopy"

/** Public props for the `<Inspector>` value tree. */
export interface InspectorProps extends Omit<BaseProps, "children"> {
  /** The value to show. Any JavaScript value works, including cycles, Maps,
   *  errors, and proxies; nothing is read until its row is shown. */
  value: unknown
  /** `block` shows the tree on its own lines. `inline` shows a one-line
   *  summary that sits in a sentence or table cell, and becomes a block when
   *  opened.
   *  @defaultValue 'block' */
  layout?: "block" | "inline"
  /** Levels open when the value first renders. `0` starts with the value
   *  closed to a one-line summary. Defaults to 1 in the block layout and 0 in
   *  the inline layout. */
  expandDepth?: number
  /** Children shown per page of an open array, object, Map, or Set.
   *  @defaultValue 100 */
  pageSize?: number
  /** Characters in a closed row's one-line summary.
   *  @defaultValue 80 */
  previewBudget?: number
  /** Characters per page of an open string.
   *  @defaultValue 5000 */
  textPageSize?: number
  /** Base for numbers.
   *  @defaultValue 'decimal' */
  numericBase?: "binary" | "octal" | "decimal" | "hex"
  /** Show strings without quotes. */
  unquotedStrings?: boolean
  /** Accessible name for the tree. */
  "aria-label"?: string
}

type View = {
  root: InspectNode
  toggled: ReadonlySet<string>
  pages: ReadonlyMap<string, number>
  /** The row a context menu last opened on. */
  menuRow: string | null
}
const NONE: ReadonlySet<string> = new Set()
const NO_PAGES: ReadonlyMap<string, number> = new Map()

// The copy item's label names the value's type, as DevTools does.
function copyLabel(kind: NodeKind): string {
  switch (kind) {
    case "string": return "Copy string"
    case "number": case "bigint": return "Copy number"
    case "boolean": return "Copy boolean"
    case "null": case "undefined": case "symbol": return "Copy value"
    default: return "Copy object"
  }
}

// Adjacent tokens of one type share a tag, which keeps the DOM small.
function renderTokens(tokens: readonly Token[], wrap: boolean) {
  const merged: Token[] = []
  for (const token of tokens) {
    const last = merged.at(-1)
    if (last && last.type === token.type) last.text += token.text
    else merged.push({ ...token })
  }
  // Spacing is CSS, so a summary has no spaces; in the inline layout, <wbr>
  // after each comma lets it wrap within its sentence without changing the
  // copied text. Block rows stay on one line.
  return merged.flatMap((token, i) => {
    const tag = <a-inspector-token key={i} type={token.type}>{token.text}</a-inspector-token>
    return wrap && token.type === "comma" ? [tag, <wbr key={`${i}b`} />] : [tag]
  })
}

function renderRow(row: InspectRow, wrap: boolean) {
  const common = {
    "row-id": row.id,
    type: row.type,
    role: "treeitem",
    "aria-level": row.depth + 1,
    style: { "--inspector-depth": row.depth } as React.CSSProperties,
  }
  if (row.type === "more") {
    return (
      <a-inspector-row key={row.id} {...common} group={row.group}>
        Show more ({row.shown.toLocaleString("en-US")} {row.unit === "characters" ? "characters" : "shown"})
      </a-inspector-row>
    )
  }
  if (row.type !== "node") return <a-inspector-row key={row.id} {...common}>{renderTokens(row.tokens, wrap)}</a-inspector-row>
  return (
    <a-inspector-row
      key={row.id}
      {...common}
      kind={row.kind}
      target={row.target}
      expandable={row.expandable ? "" : undefined}
      open={row.open ? "" : undefined}
      aria-expanded={row.expandable ? String(row.open) as "true" | "false" : undefined}
    >
      {row.key.length ? <a-inspector-key>{renderTokens(row.key, wrap)}</a-inspector-key> : null}
      <a-inspector-value>{renderTokens(row.tokens, wrap)}</a-inspector-value>
    </a-inspector-row>
  )
}

/** Interactive tree of any JavaScript value, for exploring test output. Rows
 * read like an object in browser DevTools, and open one level at a time, so a
 * large value is read only as far as it is shown. The wrapper owns the rows and
 * which are open; `<a-inspector>` turns clicks into requests, so the wrapper can
 * render from a worker. */
export const Inspector = ({
  value,
  layout = "block",
  expandDepth = layout === "inline" ? 0 : 1,
  pageSize,
  previewBudget,
  textPageSize,
  numericBase,
  unquotedStrings,
  className,
  style,
  ...rest
}: InspectorProps) => {
  const root = useMemo(
    () => describe(value, { numeric_base: numericBase, unquoted_strings: unquotedStrings }),
    [value, numericBase, unquotedStrings],
  )
  // Open rows and pages belong to one value; a new value starts fresh.
  const fresh: View = { root, toggled: NONE, pages: NO_PAGES, menuRow: null }
  const [view, setView] = useState<View>(fresh)
  const current = view.root === root ? view : fresh
  const update = (change: (view: View) => Partial<View>) =>
    setView(prev => {
      const base = prev.root === root ? prev : fresh
      return { ...base, ...change(base) }
    })

  const eventProps = useNativeEventProps({
    onnodetoggle: customEventHandler<{ id: string; open: boolean }>((_event, { id }) => {
      update(({ toggled }) => {
        const next = new Set(toggled)
        if (!next.delete(id)) next.add(id)
        return { toggled: next }
      })
    }),
    onpagerequest: customEventHandler<{ group: string }>((_event, { group }) => {
      update(({ pages }) => ({ pages: new Map(pages).set(group, (pages.get(group) ?? 1) + 1) }))
    }),
    // The menu opens at once; from a worker, this update lands before an item
    // can be chosen, and MenuItemCopy reads `copy` when it is.
    onrowmenu: customEventHandler<{ id: string | null }>((_event, { id }) => {
      update(() => ({ menuRow: id }))
    }),
  })

  const rows = visibleRows(current.root, {
    style: "tree",
    expandDepth,
    toggled: current.toggled,
    pages: current.pages,
    pageSize,
    previewBudget,
    textPageSize,
  })

  const menuRow = current.menuRow === null ? undefined : rows.find(row => row.id === current.menuRow)
  const path = menuRow?.type === "node" ? menuRow.pathText : undefined
  // Copy text is the whole value, so it's built only for the row a menu opened on.
  const menuNode = useMemo(
    () => current.menuRow === null ? undefined : rowNode(current.root, current.menuRow),
    [current.root, current.menuRow],
  )
  const valueText = useMemo(() => menuNode && copyText(menuNode), [menuNode])

  return (
    <>
      <a-inspector
        role="tree"
        tabIndex={0}
        layout={layout === "inline" ? "inline" : undefined}
        open={rows[0]?.type === "node" && rows[0].open ? "" : undefined}
        {...eventProps}
        class={className}
        style={style}
        {...rest}
      >
        {rows.map(row => renderRow(row, layout === "inline"))}
      </a-inspector>
      <Menu context>
        <MenuItemCopy label={menuNode ? copyLabel(menuNode.kind) : "Copy value"} copy={valueText ?? ""} disabled={valueText === undefined} />
        <MenuItemCopy label="Copy path" copy={path ?? ""} disabled={!path} />
      </Menu>
    </>
  )
}

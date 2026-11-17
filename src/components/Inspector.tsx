import { customEventHandler } from "../anta_helpers"
import type { BaseProps } from "../general_types"
import { describe, visibleRows, type InspectNode, type InspectRow, type Token } from "../inspector-core"
import { useMemo, useState } from "../jsx-runtime"
import { useNativeEventProps } from "../native-event-props"

/** Public props for the `<Inspector>` value tree. */
export interface InspectorProps extends Omit<BaseProps, "children"> {
  /** The value to show. Any JavaScript value works, including cycles, Maps,
   *  errors, and proxies; nothing is read until its row is shown. */
  value: unknown
  /** Levels open when the value first renders. `0` starts with the value
   *  closed to a one-line summary.
   *  @defaultValue 1 */
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

type View = { root: InspectNode; toggled: ReadonlySet<string>; pages: ReadonlyMap<string, number> }
const NONE: ReadonlySet<string> = new Set()
const NO_PAGES: ReadonlyMap<string, number> = new Map()

// Adjacent tokens of one type share a tag, which keeps the DOM small.
function renderTokens(tokens: readonly Token[]) {
  const merged: Token[] = []
  for (const token of tokens) {
    const last = merged.at(-1)
    if (last && last.type === token.type) last.text += token.text
    else merged.push({ ...token })
  }
  return merged.map((token, i) => <a-inspector-token key={i} type={token.type}>{token.text}</a-inspector-token>)
}

function renderRow(row: InspectRow) {
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
  if (row.type !== "node") return <a-inspector-row key={row.id} {...common}>{renderTokens(row.tokens)}</a-inspector-row>
  return (
    <a-inspector-row
      key={row.id}
      {...common}
      kind={row.kind}
      expandable={row.expandable ? "" : undefined}
      open={row.open ? "" : undefined}
      aria-expanded={row.expandable ? String(row.open) as "true" | "false" : undefined}
    >
      {row.key.length ? <a-inspector-key>{renderTokens(row.key)}</a-inspector-key> : null}
      <a-inspector-value>{renderTokens(row.tokens)}</a-inspector-value>
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
  expandDepth = 1,
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
  const [view, setView] = useState<View>(() => ({ root, toggled: NONE, pages: NO_PAGES }))
  const current = view.root === root ? view : { root, toggled: NONE, pages: NO_PAGES }

  const eventProps = useNativeEventProps({
    onnodetoggle: customEventHandler<{ id: string; open: boolean }>((_event, { id }) => {
      setView(prev => {
        const toggled = new Set(prev.root === root ? prev.toggled : NONE)
        if (!toggled.delete(id)) toggled.add(id)
        return { root, toggled, pages: prev.root === root ? prev.pages : NO_PAGES }
      })
    }),
    onpagerequest: customEventHandler<{ group: string }>((_event, { group }) => {
      setView(prev => {
        const pages = new Map(prev.root === root ? prev.pages : NO_PAGES)
        pages.set(group, (pages.get(group) ?? 1) + 1)
        return { root, toggled: prev.root === root ? prev.toggled : NONE, pages }
      })
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

  return (
    <a-inspector role="tree" tabIndex={0} {...eventProps} class={className} style={style} {...rest}>
      {rows.map(renderRow)}
    </a-inspector>
  )
}

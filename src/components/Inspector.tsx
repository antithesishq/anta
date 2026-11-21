import type { BaseProps } from "../general_types"
import { copyText, deepToggle, describe, jsonText, openIds, rowNode, setRowOpen, visibleTree, type InspectNode, type InspectTreeRow, type NodeKind, type Token } from "../inspector-core"
import { useLayoutEffect, useMemo, useState } from "../jsx-runtime"
import { Menu } from "./Menu"
import { MenuItemCopy } from "./MenuItemCopy"
import { Tree, type TreeAction, type TreeItem } from "./Tree"

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
   *  closed to a one-line summary. Strings always start closed.
   *  @defaultValue 1, or 0 with `layout="inline"` */
  expandDepth?: number
  /** Children shown per page of an open array, object, Map, or Set. A
   *  "Show more" row shows the next page.
   *  @defaultValue 100 */
  pageSize?: number
  /** Characters in a closed row's one-line summary with `layout="inline"`,
   *  counting the space after each comma and colon. Strings longer than this
   *  can open. In block layout, a summary instead ends at the row's edge.
   *  @defaultValue 80 */
  previewBudget?: number
  /** Characters per page of an open string. Long and multiline strings open
   *  into lines of text.
   *  @defaultValue 5000 */
  textPageSize?: number
  /** Base for numbers.
   *  @defaultValue 'decimal' */
  numericBase?: "binary" | "octal" | "decimal" | "hex"
  /** Show strings without quotes. */
  unquotedStrings?: boolean
  /** Accessible name for the tree. Give every Inspector one, such as the name
   *  of the value it shows, so screen readers can tell several apart. */
  "aria-label"?: string
}

type View = {
  root: InspectNode
  toggled: ReadonlySet<string>
  pages: ReadonlyMap<string, number>
  /** The row the open context menu is for. Null while it's closed, and until
   *  `onItemMenu` names the row, so the copy items never hold another row's text. */
  menuRow: string | null
  /** Keys for the copy items. A new key remounts an item, which clears its ✓
   *  feedback; MenuItemCopy otherwise keeps it for two seconds, across menus. */
  copyKeys: CopyKeys
  /** The last jump from a cycle to the row it refers to. */
  reveal: { id: string; n: number } | null
  /** The row a jump highlights, until the highlight fades. */
  revealed: string | null
}
type CopyKeys = { value: number; json: number; path: number }
const NO_COPY_KEYS: CopyKeys = { value: 0, json: 0, path: 0 }
// New keys for every copy item except `keep`, the one just used, so only it shows its ✓.
const remount = (keys: CopyKeys, keep?: keyof CopyKeys): CopyKeys => ({
  value: keep === "value" ? keys.value : keys.value + 1,
  json: keep === "json" ? keys.json : keys.json + 1,
  path: keep === "path" ? keys.path : keys.path + 1,
})
// Block rows render this much of a summary; CSS cuts it at the row's edge.
const BLOCK_SUMMARY_LIMIT = 300
// How long a jump from a cycle highlights its row.
const REVEAL_MS = 1500
const NONE: ReadonlySet<string> = new Set()
const NO_PAGES: ReadonlyMap<string, number> = new Map()
// Every node row has the ⋯ button, which opens the copy menu.
const ROW_ACTIONS: TreeAction[] = [{ icon: "more", label: "More actions", opensMenu: true }]

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

// Find a row by id among the rows shown.
function findRow(rows: readonly InspectTreeRow[], id: string): InspectTreeRow | undefined {
  for (const row of rows) {
    if (row.id === id) return row
    const found = row.children && findRow(row.children, id)
    if (found) return found
  }
  return undefined
}

/**
 * Interactive tree of any JavaScript value, for exploring test output, errors,
 * and logs. Rows read like an object in browser DevTools and open one level at
 * a time, so a large value is read only as far as it's shown.
 *
 * Select a row, or use the arrow keys, to open it. Right-click a row, select
 * its ⋯ button, or press Shift+F10, to copy its value, its JSON, or its path.
 * `layout="inline"` shows a one-line summary that fits in a sentence and
 * becomes a block when opened. Classes can
 * control how they appear with `inspectorRepr`. Built on `Tree`.
 *
 * @example
 * ```tsx
 * <Inspector value={testResult} aria-label="Test result" />
 * <Text>Failed with <Inspector layout="inline" value={error} aria-label="Error" /></Text>
 * ```
 */
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
  const inline = layout === "inline"
  const summaryLimit = inline ? undefined : Math.max(BLOCK_SUMMARY_LIMIT, previewBudget ?? 0)
  const rowState = { style: "tree" as const, expandDepth, pageSize, previewBudget, summaryLimit, textPageSize }
  // Open rows and pages belong to one value; a new value starts fresh.
  const fresh: View = { root, toggled: NONE, pages: NO_PAGES, menuRow: null, copyKeys: NO_COPY_KEYS, reveal: null, revealed: null }
  const [view, setView] = useState<View>(fresh)
  const current = view.root === root ? view : fresh
  const update = (change: (view: View) => Partial<View>) =>
    setView(prev => {
      const base = prev.root === root ? prev : fresh
      return { ...base, ...change(base) }
    })

  // The highlight after a jump fades on its own.
  const revealN = current.reveal?.n
  useLayoutEffect(() => {
    if (revealN === undefined) return
    const timer = setTimeout(() => update(() => ({ revealed: null })), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealN])

  const state = { ...rowState, toggled: current.toggled, pages: current.pages }
  const rows = visibleTree(current.root, state)
  const open = openIds(current.root, state)

  const toItem = (row: InspectTreeRow): TreeItem => {
    const revealed = current.revealed === row.id ? "" : undefined
    if (row.type === "more") {
      const { group } = row
      return {
        id: row.id,
        label: `Show more (${row.shown.toLocaleString("en-US")} ${row.unit === "characters" ? "characters" : "shown"})`,
        onClick: () => update(({ pages }) => ({ pages: new Map(pages).set(group, (pages.get(group) ?? 1) + 1) })),
        "data-type": "more",
      }
    }
    if (row.type !== "node") {
      return { id: row.id, label: renderTokens(row.tokens, inline), "data-type": row.type }
    }
    const target = row.target
    return {
      id: row.id,
      label: (
        <>
          {row.key.length ? <a-inspector-key>{renderTokens(row.key, inline)}</a-inspector-key> : null}
          <a-inspector-value>{renderTokens(row.tokens, inline)}</a-inspector-value>
        </>
      ),
      children: row.children?.map(toItem),
      actions: ROW_ACTIONS,
      // A cycle jumps to the row it refers to and highlights it briefly.
      onClick: target === undefined ? undefined : () =>
        update(({ reveal }) => ({ reveal: { id: target, n: (reveal?.n ?? 0) + 1 }, revealed: target })),
      "data-type": "node",
      "data-kind": row.kind,
      "data-target": target,
      "data-revealed": revealed,
    }
  }
  const items = rows.map(toItem)

  const menuRow = current.menuRow === null ? undefined : findRow(rows, current.menuRow)
  const path = menuRow?.type === "node" ? menuRow.pathText : undefined
  // Copy text is the whole value, so it's built only for the row a menu opened on.
  const menuNode = useMemo(
    () => current.menuRow === null ? undefined : rowNode(current.root, current.menuRow),
    [current.root, current.menuRow],
  )
  const valueText = useMemo(() => menuNode && copyText(menuNode), [menuNode])
  const json = useMemo(() => menuNode && jsonText(menuNode), [menuNode])
  const waiting = current.menuRow === null

  return (
    <a-inspector
      layout={inline ? "inline" : undefined}
      open={rows[0]?.type === "node" && rows[0].open ? "" : undefined}
      class={className}
      style={style}
    >
      <Tree
        items={items}
        open={open}
        onStateChange={(_event, { next, prev, scope }) => {
          // The request's own row is the shallowest one that changed.
          const changed = [...next.filter(id => !prev.includes(id)), ...prev.filter(id => !next.includes(id))]
          const id = changed.sort((a, b) => a.split(":").length - b.split(":").length)[0]
          if (id === undefined) return
          const opening = next.includes(id)
          // Set the requested state, not a flip: requests sent before a render
          // lands, as from a worker, repeat harmlessly.
          update(({ root, toggled, pages }) => {
            const rowsState = { ...rowState, toggled, pages }
            return { toggled: scope === "subtree" ? deepToggle(root, rowsState, id, opening) : setRowOpen(root, rowsState, id, opening) }
          })
        }}
        // The menu opens at once, and the copy items stay disabled until this
        // update names the row; from a worker, that's a round trip later.
        // Known gap: a right-click on another row while the menu is open moves the
        // menu without closing it, so until this update lands, the items still
        // hold the previous row's text. tests/inspector-csp.mjs pins this.
        // Each opening starts with no copy feedback showing.
        onItemMenu={(_event, { id }) => update(({ copyKeys }) => ({ menuRow: id, copyKeys: remount(copyKeys) }))}
        focusRequest={current.reveal ?? undefined}
        {...rest}
      />
      <Menu
        context
        onStateChange={(_event, { next }) => {
          // Closing clears the feedback, so it can't reappear in the next menu,
          // and forgets the row, so the next opening waits for its own.
          if (!next) update(({ copyKeys }) => ({ menuRow: null, copyKeys: remount(copyKeys) }))
        }}
      >
        <MenuItemCopy
          key={`value-${current.copyKeys.value}`}
          label={menuNode ? copyLabel(menuNode.kind) : "Copy value"}
          copy={valueText ?? ""}
          disabled={waiting || valueText === undefined}
          onCopied={() => update(({ copyKeys }) => ({ copyKeys: remount(copyKeys, "value") }))}
        />
        <MenuItemCopy
          key={`json-${current.copyKeys.json}`}
          label="Copy JSON"
          copy={json && "text" in json ? json.text : ""}
          disabled={waiting || !json || "reason" in json}
          hint={json && "reason" in json ? json.reason : undefined}
          onCopied={() => update(({ copyKeys }) => ({ copyKeys: remount(copyKeys, "json") }))}
        />
        <MenuItemCopy
          key={`path-${current.copyKeys.path}`}
          label="Copy path"
          copy={path ?? ""}
          disabled={waiting || !path}
          onCopied={() => update(({ copyKeys }) => ({ copyKeys: remount(copyKeys, "path") }))}
        />
      </Menu>
    </a-inspector>
  )
}

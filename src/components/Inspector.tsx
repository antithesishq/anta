import type { BaseProps } from "../general_types"
import { copyText, deepOpen, describe, expandToPath, inspectorPathKey, jsonText, label, matcherTest, nodeAt, openIds, searchNodes, visibleTree, type InspectNode, type InspectorMatcher, type InspectorPath, type InspectTreeRow, type NodeKind, type Token } from "../inspector-core"
import { useLayoutEffect, useMemo, useState } from "../jsx-runtime"
import { Menu } from "./Menu"
import { MenuItemCopy } from "./MenuItemCopy"
import { matchQueryRegex } from "./select-options"
import { Tree, type TreeAction, type TreeItem } from "./Tree"
import { TreeSearchBar } from "./TreeSearchBar"

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
  /** An array, object, Map, or Set with more children than this shows them
   *  in ranges, such as `[0…99]`, that open like any row. Ranges nest by tens
   *  until a level has at most 10: 100,000 items show as ranges of 10,000,
   *  then 1,000, then 100. A range reads its children only when it opens.
   *  @defaultValue 100 */
  chunkSize?: number
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
  /** Controlled open rows, as path keys (`inspectorPathKey`). When set, you
   *  own open and close: a click or key only requests a change through
   *  `onStateChange`. Keys that name no row, as after `value` changes, are
   *  ignored. Leave it undefined for uncontrolled. */
  open?: string[]
  /** Rows open on first render, as path keys, uncontrolled. When omitted,
   *  `expandDepth` decides. Replacing `value` keeps the open rows whose paths
   *  still exist. */
  defaultOpen?: string[]
  /** Fired before rows open or close. `detail.next` is the requested list of
   *  open path keys and `detail.prev` the current one; `scope` is `'subtree'`
   *  for Alt+click and Alt+Enter, and `'reveal'` when a search step opens a
   *  match's ancestors. `event.preventDefault()` vetoes an
   *  uncontrolled change; in controlled mode, apply `next` to `open`. */
  onStateChange?: (
    event: CustomEvent,
    detail: { next: string[]; prev: string[]; scope: "item" | "subtree" | "reveal" },
  ) => void
  /** The row to reveal, by path: it's scrolled into view and marked
   *  `data-current`. Open its ancestors with `inspectorExpandToPath` so it's
   *  shown. Focus doesn't move. */
  current?: InspectorPath
  /** Shows a search field above the tree. A row matches on its key or its own
   *  value: a primitive's text, a string's text, or a container's type, such
   *  as `Array(3)`, never a closed row's preview of its children. Array
   *  indices don't match. Enter or the next button reveals the next match,
   *  opening the rows above it; Shift+Enter or the previous button reveals
   *  the previous one; Escape clears the field. */
  searchable?: boolean
  /** Turns the typed query into a matcher: a RegExp, whose hits are
   *  highlighted, or a function of a row's text, which highlights the whole
   *  field. The default ignores case and treats spaces as any whitespace. */
  searchMatcher?: (query: string) => InspectorMatcher
  /** Accessible name for the tree. Give every Inspector one, such as the name
   *  of the value it shows, so screen readers can tell several apart. */
  "aria-label"?: string
}

type View = {
  root: InspectNode
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
const NO_PAGES: ReadonlyMap<string, number> = new Map()
// A row's depth from its path key: one `/` per step from the root.
const depthOf = (key: string) => key.split("/").length
// A search step needs an event to cancel, as a click's request has.
const revealEvent = () => new CustomEvent("statechange", { cancelable: true })

/** How a row's text is highlighted: hits of a RegExp, or all of it. */
type Marker = { regex: RegExp } | { all: true } | undefined

// Wraps each hit of `regex` in `text` in <mark>.
function markHits(text: string, regex: RegExp): React.ReactNode {
  const out: React.ReactNode[] = []
  let last = 0
  regex.lastIndex = 0
  for (let m = regex.exec(text); m; m = regex.exec(text)) {
    if (m[0].length === 0) { regex.lastIndex++; continue }
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<mark key={out.length}>{m[0]}</mark>)
    last = m.index + m[0].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}

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

// Adjacent tokens of one type share a tag, which keeps the DOM small. A
// marker highlights the first `marked` tokens (all by default) apart from colons.
function renderTokens(tokens: readonly Token[], wrap: boolean, marker?: Marker, marked = tokens.length) {
  const merged: (Token & { marked: boolean })[] = []
  tokens.forEach((token, i) => {
    const last = merged.at(-1)
    const mark = !!marker && i < marked && token.type !== "field_colon"
    if (last && last.type === token.type && last.marked === mark) last.text += token.text
    else merged.push({ ...token, marked: mark })
  })
  // Spacing is CSS, so a summary has no spaces; in the inline layout, <wbr>
  // after each comma lets it wrap within its sentence without changing the
  // copied text. Block rows stay on one line.
  return merged.flatMap((token, i) => {
    const text = !token.marked || !marker ? token.text
      : "regex" in marker ? markHits(token.text, marker.regex) : <mark>{token.text}</mark>
    const tag = <a-inspector-token key={i} type={token.type}>{text}</a-inspector-token>
    return wrap && token.type === "comma" ? [tag, <wbr key={`${i}b`} />] : [tag]
  })
}

// How many leading tokens a closed container's summary shares with its type
// label, which is what search matched: a preview's children never highlight.
function sharedPrefix(summary: readonly Token[], label: readonly Token[]): number {
  let n = 0
  while (n < summary.length && n < label.length && summary[n].text === label[n].text && summary[n].type === label[n].type) n++
  return n
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
  chunkSize,
  previewBudget,
  textPageSize,
  numericBase,
  unquotedStrings,
  open,
  defaultOpen,
  onStateChange,
  current: currentPath,
  searchable,
  searchMatcher,
  className,
  style,
  ...rest
}: InspectorProps) => {
  const root = useMemo(
    () => describe(value, { numeric_base: numericBase, unquoted_strings: unquotedStrings, symbol_keys: true, iterator_labels: true }),
    [value, numericBase, unquotedStrings],
  )
  const inline = layout === "inline"
  const summaryLimit = inline ? undefined : Math.max(BLOCK_SUMMARY_LIMIT, previewBudget ?? 0)
  const rowState = { style: "tree" as const, expandDepth, chunkSize, previewBudget, summaryLimit, textPageSize }
  // Open rows are path keys, so they outlive the value: replacing it keeps the
  // rows whose paths still exist open. `expandDepth` applies to the first value.
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState<string[]>(() => defaultOpen ?? openIds(root, rowState))
  const openKeys = controlled ? open : internalOpen
  const [pages, setPages] = useState<ReadonlyMap<string, number>>(NO_PAGES)
  // The copy menu and a cycle's jump belong to one value; a new value starts fresh.
  const fresh: View = { root, menuRow: null, copyKeys: NO_COPY_KEYS, reveal: null, revealed: null }
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

  // Search: the matches are recomputed when the query or the value changes.
  // `searchIndex` is the current match, null until the first step.
  const [query, setQuery] = useState("")
  const [searchIndex, setSearchIndex] = useState<number | null>(null)
  const matcher = useMemo<InspectorMatcher | null>(
    () => !searchable || !query.trim() ? null : searchMatcher ? searchMatcher(query) : matchQueryRegex(query),
    [searchable, query, searchMatcher],
  )
  const matches = useMemo(() => matcher ? searchNodes(root, matcher) : [], [root, matcher])
  const matchFields = useMemo(
    () => new Map(matches.map(match => [inspectorPathKey(match.path), match.field])),
    [matches],
  )
  // A RegExp marks its hits; a function marks a matched field whole.
  const marker = useMemo<Marker>(() => {
    if (!matcher) return undefined
    if (typeof matcher === "function") return { all: true }
    return { regex: new RegExp(matcher.source, matcher.flags.includes("g") ? matcher.flags : `${matcher.flags}g`) }
  }, [matcher])
  const lineTest = useMemo(() => matcher && typeof matcher === "function" ? matcherTest(matcher) : undefined, [matcher])
  // A new value can have fewer matches; past the end, stepping starts again.
  const matchIndex = searchIndex !== null && searchIndex < matches.length ? searchIndex : null
  const currentKey = matchIndex !== null
    ? inspectorPathKey(matches[matchIndex].path)
    : currentPath && inspectorPathKey(currentPath)
  const step = (direction: 1 | -1) => {
    const count = matches.length
    if (!count) return
    const index = matchIndex === null ? (direction === 1 ? 0 : count - 1) : (matchIndex + direction + count) % count
    setSearchIndex(index)
    // Open the rows above the match, as a request, so a controlled Inspector decides.
    const result = expandToPath(root, openKeys, matches[index].path, chunkSize)
    if (result.length === openKeys.length) return
    const event = revealEvent()
    onStateChange?.(event, { next: result, prev: openKeys, scope: "reveal" })
    if (!controlled && !event.defaultPrevented) setInternalOpen(result)
  }

  const openSet = useMemo(() => new Set(openKeys), [openKeys])
  const state = { ...rowState, open: openSet, pages }
  const rows = visibleTree(current.root, state)

  const toItem = (row: InspectTreeRow): TreeItem => {
    const revealed = current.revealed === row.id ? "" : undefined
    if (row.type === "more") {
      const { group } = row
      return {
        id: row.id,
        label: `Show more (${row.shown.toLocaleString("en-US")} ${row.unit === "characters" ? "characters" : "shown"})`,
        onClick: () => setPages(pages => new Map(pages).set(group, (pages.get(group) ?? 1) + 1)),
        "data-type": "more",
      }
    }
    if (row.type === "chunk") {
      // A range of a long group: display only, so it has nothing to copy.
      return {
        id: row.id,
        label: `[${row.start.toLocaleString("en-US")}…${row.end.toLocaleString("en-US")}]`,
        children: row.children?.map(toItem),
        "data-type": "chunk",
      }
    }
    if (row.type !== "node") {
      // A line of an open string highlights when the string matched.
      const owner = row.type === "text" ? row.id.slice(0, row.id.lastIndexOf("~line:")) : undefined
      const lineMarker = owner !== undefined && matchFields.get(owner) === "value"
        && (!lineTest || lineTest(row.tokens.map(token => token.text).join(""))) ? marker : undefined
      return { id: row.id, label: renderTokens(row.tokens, inline, lineMarker), "data-type": row.type }
    }
    const target = row.target
    const field = matchFields.get(row.id)
    // A closed container shows a preview, of which only its type matched.
    const valueMarked = field === "value" && !row.open && row.expandable && row.kind !== "string"
      ? sharedPrefix(row.tokens, label(nodeAt(current.root, row.id)!))
      : undefined
    return {
      id: row.id,
      label: (
        <>
          {row.key.length
            ? <a-inspector-key>{renderTokens(row.key, inline, field === "key" ? marker : undefined)}</a-inspector-key>
            : null}
          <a-inspector-value>
            {renderTokens(row.tokens, inline, field === "value" ? marker : undefined, valueMarked)}
          </a-inspector-value>
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
      "data-match": field === undefined ? undefined : "",
    }
  }
  const items = rows.map(toItem)

  const menuRow = current.menuRow === null ? undefined : findRow(rows, current.menuRow)
  const path = menuRow?.type === "node" ? menuRow.pathText : undefined
  // Copy text is the whole value, so it's built only for the row a menu opened on.
  const menuNode = useMemo(
    () => current.menuRow === null ? undefined : nodeAt(current.root, current.menuRow),
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
        open={openKeys}
        current={currentKey}
        toolbar={searchable
          ? (
            <TreeSearchBar
              query={query}
              onQueryChange={next => { setQuery(next); setSearchIndex(null) }}
              count={matches.length}
              index={matchIndex}
              onStep={step}
              aria-label={rest["aria-label"] ? `Search ${rest["aria-label"]}` : "Search"}
            />
          )
          : undefined}
        onStateChange={(event, { next, prev, scope }) => {
          // The request's own row is the shallowest one that changed.
          const changed = [...next.filter(id => !prev.includes(id)), ...prev.filter(id => !next.includes(id))]
          const id = changed.sort((a, b) => depthOf(a) - depthOf(b))[0]
          if (id === undefined) return
          const opening = next.includes(id)
          // Set the requested state, not a flip: requests sent before a render
          // lands, as from a worker, repeat harmlessly. Alt+click opens the
          // whole subtree, reading it from the value, not just its loaded rows.
          const result = scope === "subtree"
            ? [...deepOpen(current.root, state, id, opening)]
            : opening
              ? openKeys.includes(id) ? openKeys : [...openKeys, id]
              : openKeys.filter(key => key !== id)
          onStateChange?.(event, { next: result, prev: openKeys, scope })
          if (!controlled && !event.defaultPrevented) setInternalOpen(result)
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

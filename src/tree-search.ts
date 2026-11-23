// Search over Tree items, and the built-in search rule the Select family and
// the Inspector share. Framework-free, so the unit tests import it directly:
// `treeHighlight`, which renders hits, is in components/tree-search.tsx.
import type { TreeItem } from './components/Tree'

/** The built-in filter regex: case-insensitive, with each run of whitespace in the
 *  query matching any gap (`\s+`). Returns null for an empty query — the signal to
 *  match everything and to skip match-highlighting. */
export function matchQueryRegex(query: string): RegExp | null {
  const q = query.trim()
  if (!q) return null
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(q.split(/\s+/).map(escape).join('\\s+'), 'i')
}

/**
 * What a Tree search looks for. A string matches literally, ignoring case,
 * with spaces matching any whitespace; an empty string matches nothing. A
 * RegExp is used as given, apart from its `g` and `y` flags. A function
 * receives each item's text. `null` matches nothing: pass it when the query
 * isn't valid, such as user input that isn't a valid pattern.
 */
export type TreeSearchQuery = string | RegExp | ((text: string) => boolean) | null

/** One item a Tree search found. */
export type TreeSearchMatch = {
  /** The item's id. */
  id: string
  /** The ids of the items above it, outermost first. Open them to show the match. */
  ancestors: string[]
}

/** The query as a RegExp that finds every hit, for highlighting, or a whole-text test. @internal */
export function queryPattern(query: TreeSearchQuery): { regex: RegExp } | { test: (text: string) => boolean } | null {
  if (query === null) return null
  if (typeof query === 'function') return { test: query }
  const regex = typeof query === 'string' ? matchQueryRegex(query) : query
  if (!regex) return null
  return { regex: new RegExp(regex.source, regex.flags.replace(/[gy]/g, '') + 'g') }
}

/** Whether `text` matches the query. @internal */
export function queryTest(query: TreeSearchQuery): ((text: string) => boolean) | null {
  const pattern = queryPattern(query)
  if (!pattern) return null
  if ('test' in pattern) return pattern.test
  const regex = new RegExp(pattern.regex.source, pattern.regex.flags.replace('g', ''))
  return text => regex.test(text)
}

/** The `[start, end)` ranges of `text` the query hits; the whole text for a function query. @internal */
export function queryHits(text: string, query: TreeSearchQuery): [number, number][] {
  const pattern = queryPattern(query)
  if (!pattern) return []
  if ('test' in pattern) return pattern.test(text) ? [[0, text.length]] : []
  const hits: [number, number][] = []
  const regex = pattern.regex
  regex.lastIndex = 0
  for (let m = regex.exec(text); m; m = regex.exec(text)) {
    if (m[0].length === 0) { regex.lastIndex++; continue }
    hits.push([m.index, m.index + m[0].length])
  }
  return hits
}

/**
 * Finds the items of a Tree whose text matches `query`, in the order the Tree
 * shows them with every item open. An item's text is its `label` when that's
 * a string; pass `getText` for items whose label is JSX, or to search other
 * text. Only the items in `items` are searched: children that haven't loaded,
 * shown as `children: []`, have nothing to search, and searching never loads
 * them. Open a match's `ancestors` and set it as the Tree's `current` to
 * reveal it.
 */
export function treeSearch(items: readonly TreeItem[], query: TreeSearchQuery,
  options: { getText?: (item: TreeItem) => string | undefined } = {}): TreeSearchMatch[] {
  const test = queryTest(query)
  if (!test) return []
  const getText = options.getText ?? ((item: TreeItem) => typeof item.label === 'string' ? item.label : undefined)
  const matches: TreeSearchMatch[] = []
  const visit = (list: readonly TreeItem[], ancestors: string[]) => {
    for (const item of list) {
      const text = getText(item)
      if (text !== undefined && test(text)) matches.push({ id: item.id, ancestors })
      if (item.children?.length) visit(item.children, [...ancestors, item.id])
    }
  }
  visit(items, [])
  return matches
}

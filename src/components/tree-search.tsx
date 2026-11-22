import { queryHits, type TreeSearchQuery } from "../tree-search"

export { treeSearch, type TreeSearchMatch, type TreeSearchQuery } from "../tree-search"

/**
 * `text` with each hit of `query` wrapped in `<mark>`, for an item's label or
 * a `renderLabel`. A function query marks the whole text when it matches.
 * Without a hit, it returns `text` unchanged. Tree styles the marks, and those
 * in its `current` item's row more strongly, so Tree itself needs no search
 * state.
 */
export function treeHighlight(text: string, query: TreeSearchQuery): React.ReactNode {
  const hits = queryHits(text, query)
  if (!hits.length) return text
  const out: React.ReactNode[] = []
  let last = 0
  for (const [start, end] of hits) {
    if (start > last) out.push(text.slice(last, start))
    out.push(<mark key={start}>{text.slice(start, end)}</mark>)
    last = end
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

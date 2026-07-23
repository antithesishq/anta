// Shared option/search helpers for the Select family — `Select`, `SelectFaceted`,
// `InputAutocomplete`. Kept in one focused module (imported only by those three)
// rather than the broad `anta_helpers`, so option normalization, the filter regex,
// the match predicate, and match-highlighting can't drift between the components.
import type { OptionValue, SelectOption } from './Select'

/** Coerce a bare string option to `{ value, label }`; pass an object through. The
 *  string shorthand only occurs when `V` admits strings (the default), so casting the
 *  bare string to `V` is sound there; a `number` / `boolean` select passes objects. */
export const normalizeOpt = <V extends OptionValue = string>(o: string | SelectOption<V>): SelectOption<V> =>
  typeof o === 'string' ? { value: o as unknown as V, label: o } : o

/** The built-in filter regex: case-insensitive, with each run of whitespace in the
 *  query matching any gap (`\s+`). Returns null for an empty query — the signal to
 *  match everything and to skip match-highlighting. */
export function matchQueryRegex(query: string): RegExp | null {
  const q = query.trim()
  if (!q) return null
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(q.split(/\s+/).map(escape).join('\\s+'), 'i')
}

/** Whether an option matches the built-in query regex, testing value / label /
 *  hint. A null regex (empty query) matches everything. The value is stringified so a
 *  numeric / boolean value still matches on its text form. */
export const matchesQuery = <V extends OptionValue = string>(o: SelectOption<V>, queryRe: RegExp | null): boolean =>
  !queryRe || [String(o.value), o.label ?? '', o.hint ?? ''].some((s) => queryRe.test(s))

/** Bold the matched substring(s) of `text` for display (built-in matcher only).
 *  A null regex returns the text unchanged. The regex is re-created global so
 *  `exec` walks every match; the zero-width guard stops an empty match looping. */
export const highlight = (text: string, queryRe: RegExp | null): React.ReactNode => {
  if (!queryRe) return text
  const re = new RegExp(queryRe.source, 'gi')
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<b key={out.length}>{m[0]}</b>)
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (out.length === 0) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}

import { Button } from "./Button"
import { Input } from "./Input"

/** Props for the search field above a tree. Internal: the Inspector uses it.
 *  It knows nothing about what it searches, so it can become public later. */
export interface TreeSearchBarProps {
  /** The text typed. */
  query: string
  /** Fired as the text changes, and with `''` when it's cleared. */
  onQueryChange: (query: string) => void
  /** How many matches the query has. */
  count: number
  /** The current match, from 0, or null before the first step. */
  index: number | null
  /** Fired by Enter and the next button (`1`), and by Shift+Enter and the
   *  previous button (`-1`). */
  onStep: (direction: 1 | -1) => void
  /** Accessible name for the field.
   *  @defaultValue 'Search' */
  "aria-label"?: string
  placeholder?: string
}

const format = (n: number) => n.toLocaleString("en-US")

// "3 matches" before the first step, then "2 of 3".
function countText(query: string, count: number, index: number | null): string {
  if (!query) return ""
  if (count === 0) return "No matches"
  if (index === null) return count === 1 ? "1 match" : `${format(count)} matches`
  return `${format(index + 1)} of ${format(count)}`
}

/** A search field with a match count and previous and next buttons, for a
 *  mouse or touch. Enter steps to the next match, Shift+Enter to the previous
 *  one, and Escape clears the field. */
export const TreeSearchBar = ({
  query,
  onQueryChange,
  count,
  index,
  onStep,
  "aria-label": ariaLabel = "Search",
  placeholder = "Search",
}: TreeSearchBarProps) => {
  const text = countText(query, count, index)
  return (
    <Input
      type="search"
      size="small"
      value={query}
      aria-label={ariaLabel}
      placeholder={placeholder}
      autoComplete="off"
      onValueChange={(_event, { value }) => onQueryChange(value)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.isComposing) return
        if (event.key === "Enter" && count > 0) {
          event.preventDefault()
          onStep(event.shiftKey ? -1 : 1)
        } else if (event.key === "Escape" && query) {
          // Escape clears the search, not a dialog the tree sits in.
          event.preventDefault()
          event.stopPropagation()
          onQueryChange("")
        }
      }}
      // The count is announced as it changes. The buttons are disabled with no matches.
      trailing={
        <>
          <span aria-live="polite" aria-atomic="true">{text}</span>
          <Button priority="tertiary" icon="chevron-up" aria-label="Previous match" disabled={count === 0} onClick={() => onStep(-1)} />
          <Button priority="tertiary" icon="chevron-down" aria-label="Next match" disabled={count === 0} onClick={() => onStep(1)} />
        </>
      }
    />
  )
}

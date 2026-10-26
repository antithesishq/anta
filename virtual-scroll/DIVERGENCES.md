# Divergences from the notebook virtual scroll

`@antadesign/virtual-scroll` is a port of the notebook's `notebook/ui/printers/virtual_scroll.ts` (Star). This file
records every place the port behaves differently **on purpose**, for the migration report. It is not published (`files`
ships only `dist`).

Add an entry whenever a change makes the two differ, and say why. A difference that is not deliberate is a bug, not an
entry here. Behavior kept identical on purpose, where someone might expect a change, goes in its own section, and the
manual checks that cover what the browser tests cannot are at the end.

Star baseline: `main` at `c5a390b13ad` (2026-10-14).

## Architecture

1. **Runs on the browser thread.** Scroll state, input, row measurement, and corrections live in the element. Star runs
   them in the worker, so every wheel event waits for a worker render and two thread hops. The renderer now only answers
   `rangechange` with rows.
2. **Input goes through Anta's Capture surfaces** (`<a-capture>` in the shadow root). Star uses its own `mousecontain` /
   `touchcontain` capture and `PreventDefault` listener suffixes in `RemoteVirtualDOMStep`.
3. **Rows are one keyed list.** Star splits rows into three containers around the anchor (`vscroll__prev_rows`,
   `vscroll_anchor_row`, `vscroll__next_rows`), so a row remounts whenever it crosses the anchor. Star needs the split
   because its worker cannot read layout: rows above the anchor hang upward from it (`translateY(-100%)`), so the
   browser keeps the anchor in place without any measurement. The port measures rows on the browser thread and places
   the list from those heights in the `ResizeObserver` callback, before paint, so it does not need the split.
4. **Mounted rows are measured continuously by one `ResizeObserver`.** Star gives each row an `x-measurer`, drops it
   once the row has a height, and remounts measurers (`measure_generation`) after clearing heights. In the port a row
   that reflows in place reports its new height on its own, which closes the stale-height gap Star documents above
   `heights_ref`.
5. **`content-key` replaces `heights_epoch`.** Because mounted rows are always measured, a data change only has to clear
   heights of rows that are not mounted. Star's epoch clears every height and remounts measurers. The same attribute
   also replaces Star's sequence-hash reset of `its_end`.
6. **A width change prunes unmounted heights** (virtual lists only). Star clears every height on a width change
   (`clear_all_heights`).
7. **Separate package and generic typing.** `VirtualScroll` infers the row type from `items` and passes it to
   `renderItem(item, index)`; `mapVirtualScrollRange` gives worker renderers the same typing. Star's generic
   `vscroll_component<T>` still types `data_item_printer`'s datum as `unknown`.

## Input

8. **Keyboard is an allowlist.** The list takes unmodified Up/Down, Page Up/Down, Home/End, Left/Right (when rows are
   wider than the list), and Ctrl + Up/Down, and only when the key would move it. Everything else keeps its browser
   default and reaches page listeners. Star consumes modified keys (Alt+Left, Ctrl+Page Up/Down, Shift+arrows), keys at
   an edge, and, through its `PreventDefault` listeners, most other shortcuts. A key pressed inside a row reaches the
   row's listeners first, and the list does not scroll when one of them calls `preventDefault()`, as in a native
   scroller. Star never checks `defaultPrevented` and scrolls whatever a row did, which would block a table that moves
   a selection with the arrow keys.
9. **Dropped shortcuts.** Ctrl + wheel (one row per notch), Ctrl + Shift + wheel (page per notch), and Shift + Up/Down
   (page). Ctrl + wheel is browser zoom and trackpad pinch; Shift + arrows extend a text selection. Page Up/Down and
   Ctrl + Up/Down cover the same moves. The scrollbar hint lists the new set.
10. **`intercept-keys` for application shortcuts.** The element prevents the browser default for listed combinations
    (for example `Mod+f`) on the browser thread and still delivers the event. Star blocks defaults with
    `onKeyDownPreventDefault`, which prevents nearly every key.
11. **Wheel activation is configurable** (`wheel-activation`: hover, settled, focus, settled-or-focus). Star hard-codes
    an editor rule (`in_editor`, focus). The planned notebook adapter passes `settled-or-focus`.
12. **Horizontal wheel works on lists short enough to have no vertical scrollbar.** Star returns before handling any
    wheel input on a small list.
13. **Known limitation:** when only the horizontal axis scrolls, Shift + a vertical wheel scrolls the page, because
    Capture declines the vertical axis.
14. **Worker-latency workarounds are gone:** the 60ms trailing throttle on thumb drags, the direction "sanity" checks
    during a drag, and the 60ms throttle on Page Up/Down. The throttle stays for Shift + click paging on the track.
15. **Thumb drag mapping.** Below the non-virtual threshold the thumb follows the pointer in pixels; above it, grabbing
    keeps the fractional row so the view does not jump. Star maps every drag to a rounded row index.

## Display

16. **Placeholder lines** fill the space of rows that exist but are not mounted yet
    (`--virtual-scroll-placeholder-line`). Star never scrolls ahead of its rows, so it has no such state.
17. **The vertical scrollbar appears from the row count** before any row is measured. Star waits for measured content to
    exceed the height (it now also counts unmeasured rows at the minimum, which the port adopted).
18. **Touching marks merge**, in both layers, so DOM nodes are bounded by track pixels. Star draws one node per mark and
    caps `marked_items` at 500 in the sequence printer only.
19. **`secondary-marks` is generic.** Star's `marked_items` is named for one sequence-printer use (black-hole logs). The
    500 cap and the filter remap stay on the consumer side.
20. **A horizontal reveal keeps a 16px buffer on both sides** of the target. Star applies it to the left edge only, so a
    match at the right edge lands 16px short (bug fix).
21. **`overflow: clip` on the clip boxes**, so `focus()` or find in page inside a row cannot scroll them behind the
    transform. Star uses `overflow: hidden`.
22. **The horizontal offset is a CSS variable** (`--virtual-scroll-x`) that rows and the `header` slot inherit, so
    pinned cells follow in the same frame. Star round-trips it through `on_scroll_x` and the table's `table_scroll_x`.
23. **`item-height-fixed` still observes rows for their width** when `content-width` is not set. Star never measures
    rows when heights are fixed, so a fixed-height list without `item_width` clips wide rows and shows no horizontal
    scrollbar; only the table, which always passes `item_width`, avoids it. With both attributes set, the port observes
    no rows.
24. **Thumbs stay inside their scrollbars** (bug fix). Star lays the thumb out over the list's full height, but the
    vertical bar is inset 1px at each end and the thumb's 2px padding is added outside its computed size, so at the end
    of the list the thumb's fill runs 4px past the bar and its rounded end is cut off. The horizontal thumb does the
    same at the far right. The port measures both bars and lays thumbs, marks, and pointer input out on the track inside
    the padding. The thumb keeps Star's look everywhere else.
25. **The vertical scrollbar disappears when there is nothing to scroll**, and its column goes with it: rows and the
    horizontal scrollbar take the full width. Star hides only the thumb and keeps drawing an empty bar in a reserved
    column. Rows reflow once when the bar appears or disappears, because their width changes by the scrollbar width; the
    table port must size its columns against the space it actually gets rather than subtracting a fixed scrollbar.
26. **Rows share one width.** The row slot is as wide as the list, or as the widest mounted row's unbreakable content
    (`white-space: pre`, wide cells) when that is wider, and at least `content-width`. Every row fills it, so borders,
    backgrounds, and hover styles line up across the list. Star lays rows out at the list's width and lets wide content
    overflow each row, so every row's background stops at the list edge, or at its own width when the row is sized to
    its content.

## API

27. **Position reporting.** `positionchange` fires once scrolling settles (150ms) and `initial-position` restores it on
    connect. Star writes its whole state to `vscroll_backup_sv` on every render.
28. **Content height** arrives as `contentsizechange` (`null` until every row is measured). Star calls
    `on_visible_content_height_change` during render.
29. **Sizing** comes from `height` / `max-height` attributes and an intrinsic sizer, and honors a host sized by CSS.
    Star takes the same props but cannot be sized from outside. `max-height` alone only caps the list, as in CSS, so a
    short list shrinks to its rows; Star stays at `max_height`. The table, which renders rows directly by default and
    takes this list as an option, keeps the same height in both modes.
30. **Row selection and highlighting belong to the consumer.** Star's list owns `selected_sv` (click, Ctrl + click,
    and Shift + click ranges), `highlight_items`, and the `_selected` / `_highlighted` classes. The port renders none
    of it, so selection lives in the table and works the same whether its rows are virtualized or not.

## Kept identical on purpose

- The anchor model and its corrections: re-anchoring, overscroll at both ends, following the end, and the 2× render
  window (`items_per_page`).
- The non-virtual threshold rule, including the silent fallback to 500 when the configured value is at or below a page
  window.
- Scrollbar colors, widths, and the thumb's padded "pill" look.
- The fractional visible-bottom index from `get_visible_indices`, which reads about half a row high; nothing consumes
  it.
- Pixel wheels outside macOS move a third of their delta.
- Light-mode secondary marks use Star's faint grey (`hsla(0, 0%, 45%, 0.15)`).

## Manual checks

Run these on the docs page demos after changing the element, in light and dark mode. The browser tests cover the
scroll model; these cover what only a person can judge.

- [ ] The scrollbar track, thumb, hover, and pressed colors match the notebook's log viewer.
- [ ] The focus ring appears when the list has focus.
- [ ] At the end of a list, and at the far right of a wide one, the thumbs keep their rounded ends inside the scrollbar.
- [ ] Hovering the track or thumb for a moment shows the shortcut hint.
- [ ] **Large list:** wheel, thumb drag, track click, and Shift + click on the track all scroll; scrolling up never
      makes the top row jump.
- [ ] **Horizontal scrolling:** Shift + wheel, swipes, the horizontal thumb, and Left and Right scroll sideways; the
      vertical scrollbar still works; every row's border and hover background reach the far right.
- [ ] **Growing list:** the newest row stays on the bottom edge; scrolling up holds the view; scrolling back down by
      hand follows again.
- [ ] **Scrollbar marks:** marks line up with matching rows; Next and Previous center the highlighted word; scrolling
      away is not undone.
- [ ] **Scrollbar marks:** bookmark marks are grey, sit under search marks, and appear and disappear as rows are
      clicked.
- [ ] **Restoring a position:** Jump to row centers the row; Reopen where I left off brings back the same row and
      offset.
- [ ] **Sizing:** each list has the height in its caption; lists with nothing to scroll have no vertical scrollbar, and
      their rows reach the right edge.
- [ ] **Input:** every row of the input table behaves as listed, and every other key and wheel gesture in the log reads
      *passed to the browser*.

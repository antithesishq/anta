# Changelog

This page tracks what ships to npm. Documentation website changes are not tracked here.

## Unreleased

### Changed
- **Copy-to-clipboard is now a standalone `<a-copy>` element — `Button` / `MenuItem` (and `<a-button>` / `<a-menu-item>`) no longer carry copy props.** The `copy` / `copy-node` / `copy-url` / `copy-with-url` attributes, `onCopyRequest` / `onCopied`, and the `copydone` / `copyrequest` events moved off the base controls onto `<a-copy>`, which you slot as a child of any activatable control (a button, a menu row, a native `button` / `[role]`). It performs the write and — with `toast` — floats a ghost of the host's content upward as feedback. The base controls stay copy-agnostic; the write, the lazy pre-request, and the feedback are all the child's job. One document-delegated listener set (no per-control listeners) drives it, and it only mutates its own shadow, so it holds where the app tree renders off the UI thread. **Migration:** replace `<Button copy=…>` with `<ButtonCopy copy=…>` (or compose `<Button><a-copy copy=… /></Button>`); same for `<MenuItem copy=…>` → `<MenuItemCopy>`. `ButtonCopy` / `MenuItemCopy` keep the same prop API (`copy` / `copyNode` / `copyUrl` / `copyWithUrl` / `onCopyRequest` / `onCopied`), so code using the presets is unchanged.

### Added
- **`iconPlacement` on `ButtonCopy`** — `'leading'` (default), `'trailing'`, or `'none'`. `'leading'` / `'trailing'` place the copy glyph (which swaps to a check / ✕ on the result); `'none'` drops the glyph and gives feedback as a ghost of the label floating up (`<a-copy toast>`) plus the success / failure tone flash.
- **`ButtonCopy`'s prop surface is trimmed to what a copy button uses.** It no longer accepts `selected` (it isn't a toggle), the link/submit axis (`href` / `target` / `rel` / `download` / `ping` / `type` / `form` — a copy button neither navigates nor submits), or a public `iconTrailing` (the glyph's side is `iconPlacement`'s job). The tone / size / priority / `disabled` / `loading` / `round` / `icon` / `label` styling axes are unchanged.
- **`<a-copy>` element**, its `ACopyAttributes` type, and the `CopyTarget` prop type (the shared copy-target union consumed by `ButtonCopy` / `MenuItemCopy`).
- **`MenuItemCopy` keeps its menu open on select** (`data-menu-open`) so the copy feedback is visible instead of tearing down with the closing menu. Its prop surface is also trimmed: no `submenu` (a copy row has no flyout) or selection-indicator axis (`selectionIndicator` / `indeterminate` / `indicator` — a copy row isn't a checkable option).

### Fixed
- **An `Expander`'s heading type scale no longer leaks onto a custom (node) `title`.** The `level` typography (font-size, line-height, and the heading font-weight) moved off the shadow header `<button>` — where it inherited into whatever the `title` slot projected — onto `a-expander-summary`, the element the wrapper wraps a *string* `title` in. A string `title` renders exactly as before; a node `title` (a `<Title>`, a `<Button>`, arbitrary markup) now inherits nothing from the header and keeps its own typography, and the header button renders at the plain inherited font. As a side effect the pre-upgrade header skeleton picks up the correct per-level font, removing a font-size flash on element upgrade.

## 0.3.11 — July 21, 2026

### Changed
- **Lazy copy is now off-UI-thread safe, and `copyLazy` is gone.** The lazy path no longer hands the consumer a `provide` callback on click — a function can't cross a worker boundary, and the async round-trip missed the click's activation window, so `copyLazy` never worked in a worker-rendered app. Instead, a copy control emits a **serializable `copyrequest`** on **pointerdown** (keyboard: on keydown) whenever it has a `copy` attribute; the consumer refreshes the reactive `copy` value in response, and the **activation** copies whatever `copy` then holds. The pointerdown→click (and keydown→keyup) gap absorbs the round-trip, and only a string crosses the boundary via the normal re-render. Migration: drop `copyLazy`, keep `copy` reactive, and change `onCopyRequest={(provide) => provide(text)}` to `onCopyRequest={() => setCopy(text)}` (a state update that feeds `copy`). The `copy-lazy` element attribute and the `copyrequest` `detail.provide` are removed. (Content that can only be produced by a bare programmatic `.click()`, with no preceding pointer/keyboard event — e.g. some assistive-tech activations — can't be resolved this way; use an eager `copy` there.)
- **`<a-button>` and `<a-menu-item>` activate on key release (keyup), not keydown.** Enter and Space now fire on `keyup` (`keydown` prevents the Space page-scroll and arms the release), via one shared activation path (`installKeyActivation`). A menu's combobox-filter Enter (searchable `Menu` / `Select`) follows the same keyup contract. This matches the native `<button>` (Space already activated on release), makes keyboard activation **cancelable** (move focus before releasing → no fire), and is what gives lazy copy a keydown→keyup gap to resolve fresh content — so lazy copy works via keyboard, not just pointer. Activation is imperceptibly later and no longer key-repeats (it already didn't); programmatic `.click()` is unaffected.
- **A link `Button` / `MenuItem` (`href`) can no longer take copy props — enforced by the types.** `copy` / `copyNode` / `copyUrl` / `copyWithUrl` / `onCopyRequest` / `onCopied` are now `never` in link mode, so `<Button href=… copy=…>` or `<ButtonCopy href=…>` is a compile error instead of a silently-ignored attribute (a link navigates; it isn't a clipboard control). `MenuItem`'s link mode already excluded them; `Button` now matches.

### Added
- **`copyUrl` / `copyWithUrl` on copy controls.** `copyUrl` (element: `copy-url`) copies the current page URL (`location.href`) with no `copy` value; `copyWithUrl` (element: `copy-with-url`) prefixes a `copy` string with `// URL: <href>` so a copied snippet links back to its source. Available on `Button` / `ButtonCopy` / `MenuItem` / `MenuItemCopy` and the underlying `<a-button>` / `<a-menu-item>`.
- **`placement` and `offset` on `Select` and `SelectFaceted`.** Both now forward two of `Menu`'s positioning props: `placement` (preferred side and edge alignment, same values as `Menu`, auto-flipping and clamping when space runs out) and `offset` (gap in pixels between the trigger and the menu, default `4`). The menu's side and its distance from the field / button are tunable without a custom trigger.

### Fixed
- **A `context` `Menu` no longer opens from a right-click on a modal or popover above its anchor.** When the `contextmenu` event's composed path crosses an open `:modal` `<dialog>` or a `:popover-open` element before it reaches the menu's anchor, the menu stays closed and lets the top-layer surface own the right-click. Before, a `context` menu registered on a page region hijacked right-clicks that landed on a `Dialog` / popover layered over it (the event still bubbled through the anchor). Uses the same composed-path walk as the dismiss and expander-toggle contracts, so it holds when consumer handlers run off the UI thread.
- **A control in an `Expander`'s title no longer toggles the section.** The `title` slot projects *inside* the header button, so a click on a `ButtonCopy` / link / form control placed next to the title text bubbled to the toggle and opened/closed the section on every activation. `<a-expander>` now refuses to toggle when the click landed on an interactive control or on an explicit `[data-expander-ignore]` node — so a copy button beside the title copies without opening the section, with no consumer setup. The recognized controls are every Anta control (`a-button`, `a-checkbox`, `a-radio`, `a-radio-group`, `a-input`, `a-input-time`, `a-calendar`, `a-menu-item`, `a-tab` — which transitively covers `Select` / `InputDate` / `InputAutocomplete`, `Menu`, and `Tabs`, since those compose from these tags), a wrapped anchor-button (`[data-anta][role="button"]`), and native `button` / `a[href]` / `input` / `select` / `textarea` / `label` / editable. A **disabled** control is inert, so it's exempt — its click toggles the section like the title text (`:disabled`, `[disabled]`, and `aria-disabled="true"` are all read as disabled). The decision is made synchronously in the element by walking the click's composed path (like `Menu`'s dismiss contract), so it holds in runtimes where consumer event handlers run off the UI thread and a light-DOM `stopPropagation()` would arrive too late. Suppressing before the dispatch also means a *controlled* consumer sees no `statechange`, so the section stays put. Header `actions` were already immune (they're siblings of the button, not inside it).

## 0.3.10 — July 20, 2026

### Changed
- **`Title` is now margin-free.** `<a-title>` (and `<Title>`) dropped the per-level `margin-block-start` / `margin-block-end` it baked in at every level, so it's a spacing-neutral atom that drops into cards, toolbars, and flex/grid cells without leaking margin or fighting the container's `gap` / `padding` — the parent owns spacing. Matches the margin-free `Text` and the primitives in Radix, Mantine, Chakra, and Polaris. Raw `<h1>`–`<h6>` still carry the per-level vertical rhythm via `src/reset.css` for document prose, so heading markup in running copy is unchanged; only the component diverges. Migration: where you relied on a `<Title>`'s built-in margin, add spacing on the surrounding container (a `gap` on the stack, or padding) — or use a raw heading tag for prose.

### Fixed
- **`Text` and `Title` pin their `font-family`.** Both now set `font-family: var(--sans-serif)` on the host instead of relying on inheritance, so a consumer's `font-family` on an ancestor container can no longer reach in and restyle body copy or headings — the same defensive restatement they already do for `font-feature-settings`, and the same pin every shadow-DOM control (`Button`, `Input`, `Tag`, …) already carries. No change where `--sans-serif` is undefined (falls back to inherited, as before).

### Added
- **Copy button & copying menu item.** `ButtonCopy` and `MenuItemCopy` copy to the clipboard on activation. Exactly one mode (enforced by the `CopyMode` discriminated union): `copy` for a literal string; `copyNode` (bare → nearest `data-copy-source` ancestor; a selector → `closest()`) to copy a DOM region as rich text (`text/html`) + plain text with the copy control stripped from the output; or `copyLazy`, where the content stays out of the DOM until the click fires `onCopyRequest(provide)` and you call `provide(text)` (sync or after an `await`, within the click's activation window). The write lives in the web component (`<a-button>` / `<a-menu-item>`); it reports the result on a non-bubbling `copydone` event, and the wrapper flips the leading icon to a check / ✕ and retones to `success` / `critical` for ~2s. `onCopied(ok)` callback. The `copy` / `copy-node` / `copy-lazy` attributes also work on plain `<Button>` / `<MenuItem>` and hand-authored `<a-button>` / `<a-menu-item>` (the icon/tone feedback is the preset wrappers' part). Exports `ButtonCopy`, `MenuItemCopy`, `ButtonCopyProps`, `MenuItemCopyProps`, and `CopyMode`.

## 0.3.9 — July 17, 2026

### Added
- **New `settings` icon** — the Lucide gear, for `<Icon shape="settings" />` and any `icon` prop.
- **`MenuItem` renders as a link when given `href`.** A `MenuItem` with `href` renders a native `<a role="menuitem" data-anta-menu-item>` instead of `<a-menu-item>` — a real link with native navigation, `download` (`true` / filename), `target`, `rel`, `ping`, ⌘/middle-click "open in new tab", and "copy link address". The parent `Menu` treats it as a first-class row: arrow-key navigation, Enter / Space activation, and close-on-select all work, mixed freely with regular items. `onSelect` fires alongside the navigation; `disabled` drops the `href` (inert, out of the tab order); `selected` marks a current link via `aria-current`. Link mode and the checkable / `submenu` props are mutually exclusive in the types. Consumers styling items should match both shapes — `:is(a-menu-item, a[data-anta-menu-item])`.
- **Native `<button data-anta>` gets the Anta button styling.** The button CSS now attaches to three element shapes — `<a-button>`, `<a role="button" data-anta>` (link), and `<button data-anta>` (native form control) — so a real `<button>` can wear the look while keeping native form submission, `disabled`, and Enter / Space activation. `data-anta` is the opt-in marker (it keeps Anta off `role="button"` / buttons it doesn't own). `tone` / `priority` / `size` are plain attributes.

### Fixed
- **Buttons no longer collapse inside a height-constrained flex container.** `<a-button>` (and the `<a role="button" data-anta>` anchor variant) carried `max-height: 100%`, a percentage that resolves once the button is a shrinkable flex item in a definite-height line — e.g. an anchor-button in a flex menu row — letting the flex algorithm squeeze it below its content and overlap its neighbors. Dropped `max-height` (button height is anchored by the per-size `min-height` floor); `max-width: 100%` stays as a plain literal so long labels still truncate. Also removed the unused `--button-max-width` / `--button-max-height` variables, orphaned from a since-removed explicit-sizing API.

## 0.3.8 — July 16, 2026

### Added
- **`Card` (`<a-card>`)** — a surface container: a bordered, toned box that lays out an optional full-bleed `media` region (`mediaPosition` `top` / `bottom` / `left` / `right`) plus three stacked sections — `header`, body, **left-aligned** `footer` — each an independently padded section sharing one `--card-padding` (the outer inset and body→footer gap are a full `--card-padding`; the header→body gap is half; no gap doubles). Lay out any header controls (buttons, tags) inside the `header` itself — there's no separate actions slot. `tone` (named or any CSS colour) and `priority` (`secondary` / `primary` / `tertiary`) drive the surface; `size` scales padding, the wrapped body text, and the icon chip; `selected` draws an inset ring; `loading` shows a skeleton pulse. Pass `href` to turn the whole card into a link — the shadow container becomes a focusable anchor whose accessible name comes from the header → body → URL. The card stylizes only its own surface (never its content's typography) and is `position: relative` so content can be absolutely positioned inside it. The wrapper wraps a string `header` in a `<Title>` (level tracks `size`: small → 5, medium → 4, large → 3) and a string body in a `<Text>`, both following the card's `tone` (named *or* custom) and `size`; a string `icon` renders in a tone-aware circular chip (`--card-icon-size` / `--card-icon-bg`). Pass your own nodes to override any of them. `::part(container | media | content | header | icon | title | body | footer)`. Exports `CardProps`.

### Changed
- **`Text` and `Title` accept a custom tone.** `tone` now takes any literal CSS colour (`'#ff1493'`, `'rebeccapurple'`), not just the six named tones, derived in oklch across the full priority scale in light and dark from `--text-tone-source` / `--title-tone-source` — the same mechanism as `Button` / `Tag` / `Card`.

### Fixed
- **A stateful control inside a controlled `Dialog` no longer closes it.** `Checkbox`, `Tabs`, and `RadioGroup` fired their `statechange` with `bubbles: true` / `composed: true`, so the event climbed to an enclosing `<a-dialog>` (or any ancestor listening for `statechange`), which read the descendant's payload in its own vocabulary — `next: "unchecked"` looked like a close request — and dismissed the dialog. Two layers: `statechange` is now point-to-point (neither bubbling nor composed) on every stateful element, matching `Menu` / `Dialog` / `Expander` / `Calendar`, which already were; and the container wrappers (`Dialog`, `Menu`, `Expander`) now ignore any `statechange` that bubbled from a descendant (`event.target !== event.currentTarget`), so a consumer's own or third-party bubbling control can't dismiss them either. The post-apply `change` event still bubbles like a native form control.
- **`round={0}` now squares the corners instead of being ignored.** Every wrapper with a `round` prop (`Button`, `Tag`, `Input`, `Menu`, `Tooltip`, `Dialog`, `Expander`, `Checkbox`, `Progress`, `InputTime`, `Tabs`, `Card`) treated `0` as falsy and dropped the attribute, falling back to the default radius; `round={0}` now applies a 0px radius. Centralized in a shared `roundAttr` helper.
- **An empty-string `tone` on `Text` / `Title` / `Tag` renders neutral.** Now that `tone` accepts any CSS colour, `tone=""` had started taking the custom-colour path (empty `--*-tone-source` → invalid oklch → `currentColor`); it normalizes to the untinted default again.

## 0.3.7 — July 15, 2026

### Fixed
- **`Menu` opens from the keyboard via the element, not a synthesized click.** `<a-menu>` now binds a keydown on its trigger anchor and opens itself: either arrow (ArrowUp / ArrowDown) on any field trigger, plus Enter / Space on a read-only trigger like `Select` (on an editable one like `InputDate` those stay with the field for typing / commit). Button and link triggers are unchanged — their own Enter/Space click still opens. Removes the `Select` / `InputDate` wrappers reaching for the live trigger node to call `.click()`, which threw in runtimes that reconcile the DOM off the main thread; any custom-trigger menu now gets keyboard-open for free.

### Changed
- **Read-only `Input` draws its focus ring on keyboard focus only.** A `readOnly` field (a `Select` / `SelectFaceted` trigger) rings when focused by keyboard but not by a mouse click that opens its menu. `:focus-visible` can't express this — a browser reports it `true` for a focused `<input>` on mouse click too — so `Input` tracks the focus source itself (last interaction: pointer vs. key) and rings via an off-DOM `:state(kb-focus)`. Editable fields are unchanged (they ring on any focus — you clicked in to type).

## 0.3.6 — July 13, 2026

### Added
- **`Dialog` (`<a-dialog>`)** — a modal dialog and edge drawer on a native `<dialog>`, so the top layer, focus trap, focus return, backdrop, and Esc come from the platform. `position` gives a centered modal, `left` / `right` / `top` / `bottom` drawers, or `fullscreen`; `persistent` disables light dismiss for alert/confirm dialogs. `header` / body / `footer` zones, `round` corners, and `::part` styling. Controlled (`open`) or uncontrolled. Exports `DialogProps`.
- **`InputAutocomplete`** — a text field whose value is free text, with a suggestion dropdown that assists without constraining (for a value locked to the list, use `Select` with `filter`). `filter` is the built-in matcher, a custom predicate, or `false` to feed pre-filtered `suggestions` (async / remote); a proper ARIA combobox. Controlled (`value`) or uncontrolled. Exports `InputAutocompleteProps`.
- **`Menu` / `MenuItem` / `Input` gain an optional `role` prop.** Overrides the element's default ARIA role (`Menu` `menu` → `listbox`, `MenuItem` `menuitem` → `option`), which is what lets `InputAutocomplete` present its dropdown as a combobox listbox.

### Fixed
- **`Tooltip` closes when its content is emptied while shown.** A bubble whose slotted content is cleared out from under it (a reactive re-render) now self-hides, the mirror of the show-time empty gate. Previously it stayed up as a blank frame.

### Changed
- **Menu combobox filter fields — Home / End move the caret.** In a menu's search field (`Select`'s `filter`, `InputAutocomplete`), Home / End now move the text caret to the line start / end instead of jumping the option list; PageUp / PageDown jump the list to the first / last option.
- **`SelectFaceted` gains a `toneSelected` prop.** Tones a selected option row (e.g. `brand`), matching `Select`. Defaults to a neutral selection.
- **`SelectFaceted` `multiple` facets gain the Alt/⌥-click isolate accelerator + hint.** Alt/⌥-click a row to select only it, taught by a default tooltip — matching `Select`. Tied to the facet's `selectAll`; override the hint via a row's `tooltip`.
- **`Select` `selectAll` now defaults on for `multiple` selects.** The Select-all row (and the Alt/⌥-click isolate that rides on it) now show without opting in; pass `selectAll={false}` to drop them.
- **`SelectFaceted` `multiple` facets now default to a "Select all" row.** Each `kind: 'multiple'` facet gets the "Select all" row without setting `selectAll`; set `selectAll: false` on the facet to drop it. Was opt-in.

## 0.3.5 — July 13, 2026

### Added
- **`SelectFaceted`** — a faceted filter: one trigger opens a menu of facet flyouts, each with its own editor (`single` / `multiple` / `text` / `custom`). The value is a `Record<facetKey, value>`, so the same value under two facets stays distinct. `searchable` global search, `clearable` rows, and `renderTrigger`. Composed from `Menu` / `Input` / `Tag` — no new element. Controlled or uncontrolled. Exports `SelectFacetedProps` and the per-kind facet types.
- **`InputTime` (`<a-input-time>`)** — a segmented wall-clock time field with hour / minute / AM-PM spinbutton sections and arrow-key stepping. The clock (12h/24h) is locale-derived via `Intl` (`hour12` overrides); the value is a 24-hour `"HH:mm"` string, form-associated, with `min` / `max` clamping. Controlled or uncontrolled. Not SSR-safe. Exports `InputTimeProps`.
- **`Menu` `autoWidth` prop** — sizes the menu to its content instead of flooring its width to the trigger. `InputDate` uses it so its calendar wraps its own width under a full-width field.
- **`TabOption.tooltip`** — a per-tab tooltip shown only when the tab's label is truncated, revealing the full text on hover. Mirrors `SelectOption.tooltip`.

### Fixed
- **`Menu` — closing a menu now closes the menus stacked above it.** `requestClose` trims and notifies deeper entries in the open stack, so a nested *controlled* menu isn't stranded `open` with no way to reopen. Fixes the calendar's month/year jump menu getting stuck after: open the `InputDate` calendar → open the jump menu → click the field to close the calendar → reopen → the jump menu wouldn't open (its controlled state was still `open`).
- **`MenuItem` radio dot re-centered.** A `MenuItem` with `selectionIndicator="radio"` rendered its selected dot pinned to the top edge of the ring instead of the centre: the menu's label-less centering zeroed the standalone `margin-block-start` on both the ring (`::before`) and the dot (`::after`), which discarded the offset that keeps the smaller dot concentric with the ring. The dot now keeps a `(control − dot) / 2` offset so it sits centred in the ring (checkbox rows were unaffected — their glyph is box-sized and stacks on the box).
- **`InputDate` — typing drives the calendar, and `Enter` commits + closes.** As you type a recognized date the calendar previews it (jumps to that month and highlights the day) without committing; `Enter` commits the typed date and closes the calendar. An unrecognized entry keeps the calendar open and marks the field `critical`. Previously the calendar updated only on blur, and `Enter` did nothing (a standalone input's `change` fires on blur, not Enter).

### Changed
- **`Calendar` jump menu marks the selected month with a dot.** The current month in the year → month flyout now shows the same trailing dot as the active year (was a trailing check), so year and month read consistently.
- **Text-selection colour (`::selection`) now uses the focus ring.** Was the brand colour at 15% alpha; it's now `--focus-ring` at 20% (light) / 30% (dark) alpha — applies to selected text everywhere, prose and inside inputs.
- **`Calendar` selected day is toned `brand`.** The active date now renders as a `tertiary` Button in its `selected` state toned `brand`, so the selection reads in the brand color instead of the neutral selected fill. Applies to standalone `Calendar` and to `InputDate`'s calendar. Today (when not selected) is unchanged (a neutral `secondary` Button).
- **`InputDate`'s time row uses `InputTime`.** In `time` mode the controls under the calendar are now the new segmented `InputTime` (replacing the two number inputs + AM/PM `Tabs`), so time editing matches the standalone component — spinbutton hour / minute / AM-PM sections, ↑/↓ stepping, and 24h→12h conversion. The value format (`YYYY-MM-DDTHH:mm`), the locale clock, and `hour12` are unchanged.
- **`InputDate` `icon` accepts `false`.** The leading-icon prop now takes `false` to drop the calendar icon entirely (was: an icon shape only) — matching `InputTime`.
- **`Calendar` follows a controlled `value` change to the visible month.** Setting `value` to a date in another month now moves the shown month to it. Before, only the initial value positioned the view; a later change updated the selected day but left the month put. Uncontrolled calendars and manual month navigation are unaffected (the move fires only on an actual `value` change). This is what lets `InputDate` preview a typed date's month.
- **`Tabs` sizing + track restyle.** A tab is now a prescribed height (24/28/32, matching Button's scale) and the strip carries no padding by default, so a strip is exactly a same-size button / input tall. Rings are crisp 0.5px inset outlines via `--tabs-track-border` and `--tab-selected-border`. For a roomier "well" look, override the strip's `padding` in plain CSS.
- **`Button` selected state uses the hover fill, not active.** A `[selected]` `a-button` / `a[role="button"][data-anta]` now takes the hover background (was the darker active background) across secondary / primary / tertiary, so a selected button reads like a resting hover rather than a held press. Its `[selected]` inset ring also thins from 1px to 0.5px, matching the thinner ring weights elsewhere.
- **`Tooltip` bubble text uses `--text-2`.** The bubble's default text colour moves from `--text-3` to `--text-2` (a step stronger), with the same `CanvasText` fallback.

## 0.3.4 — July 10, 2026

### Added
- **`optionsWithSelection(options, values)` helper** — a pure function that projects a `Select` `options` tree onto a selection: returns the same tree (bare strings normalized) with every leaf marked `selected` and every group / submenu carrying a rolled-up `selectionState` (`'none' | 'some' | 'all'` of its descendant leaves). Needs no `Select` instance and reads nothing off the change event, so it behaves the same controlled or uncontrolled — feed it your current `value` to render a grouped summary, section indicator, or diff. Exported with types `SelectedItem` / `SelectedOption` / `SelectedGroup` / `SelectedSubmenu` / `SelectionState`.
- **`SelectOption.tooltip`** — a per-option row tooltip (string or node). In a `multiple` select with `selectAll`, a row with no `tooltip` falls back to a default hint for the Alt/Option-click accelerator (below); set `tooltip` to override, or `''` to suppress.
- **`TabOption.children`** — an `options`-array tab can carry a node for its content, not just a string `label` (`label` wins when both are set).
- **`Calendar` `focusSignal` prop.** A nonce (change it — e.g. increment a counter — to fire) that moves keyboard focus onto the calendar's active day, driven declaratively through `<a-calendar>`'s `data-focus`. `InputDate` bumps it on a keyboard open so focus lands in the grid without the wrapper ever touching the DOM.

### Changed
- **`Tabs` is options-only; the `<Tab>` component is gone (breaking).** The strip renders solely from the `options` array (`TabOption[]`, shipped in 0.3.3) — the `<Tab>` component and its `TabProps` type are removed. Migrate by moving each `<Tab>`'s props into an `options` entry (the field names are identical); `<TabPanel>` children are unchanged.

  ```tsx
  // Before
  <Tabs defaultValue="a" label="Sections">
    <Tab value="a" label="Overview" icon="home" />
    <Tab value="b" tone="critical" disabled><Badge /> Alerts</Tab>
    <TabPanel value="a"><Overview /></TabPanel>
  </Tabs>

  // After — <Tab> props become option objects; a rich <Tab> body becomes `children`
  <Tabs
    defaultValue="a"
    label="Sections"
    options={[
      { value: 'a', label: 'Overview', icon: 'home' },
      { value: 'b', tone: 'critical', disabled: true, children: <><Badge /> Alerts</> },
    ]}
  >
    <TabPanel value="a"><Overview /></TabPanel>
  </Tabs>
  ```

  `<TabPanel>` now renders a real `<a-tabpanel>` element (new, registered via `@antadesign/anta/elements`) that reads the active value from its sibling `<a-tabs>` and shows/hides itself off-DOM (`:state(active)`); `Tabs` never introspects or toggles its children, so it renders the same across React / Preact / custom runtimes and static SSR. `TabPanel` gains **`hideMode`** — `'display'` (default, removed from layout + a11y tree) or `'visibility'` (keeps the layout box). The old `mounting="active" | "lazy"` is dropped: to not-render an inactive panel (unmount or lazy-mount), drive a controlled `value` and render panels conditionally yourself (see the docs). The tab↔panel a11y link is off-DOM (`ariaLabelledByElements`), so no `id` wiring is emitted.

  `Tabs` renders **no wrapper element** — the strip (`<a-tabs>`) and the panels render as flat siblings, and `className` / `id` / `style` / `...rest` land on the strip. Laying the strip out relative to its panels is the consumer's job: a horizontal strip stacks above its panels in normal flow with no extra markup, and a vertical strip sits beside its panels only if you wrap `<Tabs>` in your own flex row. Panels still resolve their strip as a sibling under the same parent, so keep them together (or drive a controlled `value` to split them into separate regions).
- **`Select` warns on duplicate option values (dev only).** A leaf `value` is the option's identity and must be unique across the whole tree (selection is value-keyed and global across groups / submenus); duplicates collapse into one logical pick. `Select` now `console.warn`s on a repeat, matching `Tabs` / `RadioGroup`.
- **`MenuItem` `onSelect` now fires only for selectable rows.** `a-menu` decides which row a click selects — skipping disabled rows and submenu parents — and emits a pre-filtered `menuselect` event the wrapper forwards, replacing the wrapper's old `.closest()` DOM walk (which doesn't exist off the UI thread). A click on a submenu parent or disabled row no longer invokes `onSelect`.
- **`Select`: Alt+Click a row selects only that one** (`multiple` + `selectAll`). Plain click still toggles; Alt+Click isolates — clears the rest, selects just that row — with no extra UI. A per-row hint tooltip teaches it (platform-worded: ⌥+Click on macOS, Alt+Click elsewhere) and stays unobtrusive — a longer show delay and it follows the cursor; suppress or replace it via `SelectOption.tooltip`.
- **A submenu's parent row stays highlighted while its flyout is open** — keyed off the nested menu's own off-DOM `:state(open)` (`a-menu-item:has(> a-menu:state(open))`), so the branch you're in reads as active even after the pointer moves into the flyout.
- **Web components no longer write light DOM (ARIA included).** `a-menu` used to `setAttribute` `aria-expanded` on a submenu's parent and `aria-activedescendant` on a combobox filter field — light-DOM writes that desync a worker-thread reactive model. Now: submenu open state is off-DOM (`:state(open)`, styled via CSS; `aria-expanded` is dropped rather than written), and the combobox active-option is emitted as an `activedescendant` event that the reactive layer (`Select`) reflects onto the field itself. Behavior is unchanged for consumers; the element layer is now free of light-DOM mutation.
- **`InputDate` opens the calendar from the field, not a trailing button.** Clicking anywhere in the field opens the calendar (the menu now anchors to the field, like `Select`), and a leading calendar icon marks the affordance — the `icon` prop defaults to `calendar-days` and still overrides it. The separate trailing calendar button is gone. A mouse open keeps focus in the field, so you can keep typing or click a day; <kbd>ArrowDown</kbd> opens the calendar and moves focus into the grid, and <kbd>Esc</kbd> closes it back to the field. <kbd>Enter</kbd> still commits the typed date. The field carries `aria-haspopup="dialog"` + `aria-expanded`.

### Fixed
- **A hover-opened submenu no longer closes on hover-away once you've keyboard-focused into it.** After a submenu opens on hover, moving keyboard focus into it (e.g. ArrowRight / ArrowDown) and then moving the mouse away used to schedule the flyout closed, yanking it out from under the keyboard. `scheduleClose()` now skips while a `:focus-visible` element is inside the submenu (a deeper flyout keeps its ancestors open too). The explicit close paths — Esc, ArrowLeft, outside-click, focus leaving on Tab — are unchanged, and a submenu with no keyboard focus still closes on hover-away as before.
- **`Input` pins its variable-font width axis.** The shadow `<input>` / `<textarea>` now restates `font-variation-settings` (`wdth 100`, upright), because the UA form-control `font` shorthand resets the variable-font axes to the font file's default instance. With a variable `--sans-serif` the field text otherwise rendered at a different width from the surrounding text and shifted as the font loaded. `Select` and `InputDate` triggers (built on `Input`) inherit the fix.
- **`Input` skeleton renders its content before upgrade, not just an empty box.** Building on 0.3.3's reserved field box, `a-input:not(:defined)` now paints the field's text — the `value`, or the `placeholder` when empty — and matches the shadow control's type scale (font size / line-height / weight per `size`, feature settings, and variable-font axes), so a not-yet-upgraded / SSR'd field reads as populated and the label + value hold position across upgrade. The label matches the shadow `.label` metrics so the field below it doesn't jump; adornments and the hint are held back until the shadow exists; and the field fades from a dimmed rest state to full opacity on `:defined` (skipped under `prefers-reduced-motion`). A `password` field never paints its value in the skeleton. This most visibly smooths the `Select` and `InputDate` triggers on load.

## 0.3.3 — July 8, 2026

### Added
- **`InputDate`** — a date (and date-time, with `time`) field, composed from `Input` + `Menu` + `Calendar`. Type freely; it resolves on blur or Enter with a locale-aware parser (field order, month names, run-together digits) and rewrites the entry to the canonical format. An unrecognized entry marks the field `critical` and keeps the text. The trailing button opens the calendar. `time` makes the value `YYYY-MM-DDTHH:mm` and adds a time row with a 12- or 24-hour clock (locale-driven, `hour12` to override; a 24-hour hour typed into a 12-hour field auto-converts). Controlled or uncontrolled, submits ISO under `name`. Exports `InputDateProps` / `InputDateChangeAttrs`.
- **`Calendar`** — a single-date month grid, composed from Anta components in light DOM (no shadow root). Days and chevrons are `<Button>`s, so a selected day is a `tertiary` Button in its `selected` state and inherits the design-system look. The `<a-calendar>` element owns the form value and dispatches the events (`statechange` / `change` / `navigate`), so it drives a vanilla consumer too; the renderer owns the grid, the displayed month, and the roving `tabindex`. Date math runs on the Temporal API (`temporal-polyfill`, a new bundled runtime dependency); the value is an ISO `YYYY-MM-DD` string. The month/year heading opens a `Menu` for jumping the view. Controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`), with `min` / `max` / `locale` / `size`. Exports the pure engine (`buildMonth`, `getWeekdays`, `firstDayOfWeek`, `clampDate`, `isOutOfRange`, `parseISODate`, plus `CalendarDay` / `CalendarWeekday` / `CalendarMonth` / `BuildMonthOptions`) for consumers who render their own grid.
- **`Select`** — a single- or multi-select dropdown, composed from `Input` + `Menu`. A read-only trigger shows the value(s) with a chevron; a `Menu` of options opens on click. `selection` is `"single"` (default) or `"multiple"` (checkbox rows, an "N selected" count, opt-in `selectAll`). `indicator` picks the single-select mark (`"none"` / `"check"` / `"radio"`). `filter` adds a combobox search field (built-in matcher with match-highlighting, or a custom predicate). Options can nest as `SelectGroup` (inline titled section) or `SelectSubmenu` (flyout), with global selection; `renderOption` / `renderIndicator` / `renderTrigger` / `renderEmpty` swap the row content, mark, trigger, or empty state. `toneSelected` tones the chosen row(s). Controlled or uncontrolled, one `onValueChange(value, attrs)`. Exports `SelectProps` / `SelectOption` / `SelectGroup` / `SelectSubmenu` / `SelectItem` / `SelectChangeAttrs` / `OptionState` / `TriggerState` / `EmptyState`.
- **Date-input engine helpers**, alongside `buildMonth`: `parseDateInput(text, locale, { min, max })` recognizes a date from free-form text or returns `null`; `formatDateInput(date, locale)` renders the canonical numeric string; `dateFormatPattern(locale)` returns the placeholder mask. Their date-time siblings back `InputDate time`: `parseTimeInput`, `parseDateTimeInput`, `formatDateTimeInput`, `dateTimeFormatPattern`, and `usesHour12(locale)`. All force latin digits so the parse/format round-trip is deterministic. Type `ParseDateOptions`.
- **`Menu` fixed `header` / `footer` slots + scrolling body**, exposed as `::part(scroll)`. Content in `header` / `footer` (a filter field, a footer action) stays pinned while the items scroll; the body's edges soft-fade, and the top clears a hard band so a row vanishes cleanly under a pinned header.
- **`Menu` combobox mode + `MenuItem` `active`.** A `Menu` with a search field marked `data-menu-search` switches to the WAI-ARIA combobox keyboard (arrows move an active cursor while focus stays in the field, `aria-activedescendant` reflected), and re-anchors to the trigger as its filtered height changes. The cursor rides a new `MenuItem` `active` element property mirrored to `:state(active)`. Powers `Select`'s `filter`.
- **`MenuItem` selection props.** `selected` marks a row chosen (tint, or the indicator on a checkable row); `selectionIndicator` (`'checkbox' | 'radio' | 'check'`) makes the row a checkable control (row flips role + `aria-checked`), with `indeterminate` for a mixed "Select all"; `indicator` (`ReactNode`) replaces the mark visual; `hint` adds secondary text under the label; `tone` now accepts a custom CSS colour. These back `Select`'s row rendering.
- **`MenuSeparator` accepts text** — a small muted caption (role flips to `status` with `aria-live="polite"`). Empty, it's the hairline divider as before. This is where `Select`'s `renderEmpty` messages render.
- **`round` attribute across components** — fully-round corners (`border-radius: 999px`, clamped to half the shorter side), or a custom radius via a value (`<Button round={20} />`). On `Button`, `Input`, `Progress`, `Checkbox`, `Tabs` / `Tab`, `Menu` (20px container), `Tooltip` (20px), and `Expander` (corners sized to half the folded header height).
- **`Tabs` `options` prop** — render tabs from a data array instead of `<Tab>` children (mirrors `RadioGroup`). New exported type `TabOption`.
- **`toneSelected` on `Checkbox`, `RadioGroup` (+ per-option), and `MenuItem`** — tones the checked mark only, leaving the resting control neutral, so a tinted control doesn't read as a validation state before it's chosen. Same value set as `tone`; on the elements it's the `tone-selected` attribute.
- **`Text` / `Title` `tone="neutral"`** — the untinted `--text-{N}` scale, added for parity with `Button` / `Tabs`. Renders identically to omitting `tone`.
- **`Button` `role` prop** — an ARIA role override (e.g. `role="gridcell"`), forwarded to the element. Defaults to `button`.
- **`getAnchorRect()` anchor protocol for `Menu` & `Tooltip`.** An anchor can implement `getAnchorRect(): DOMRect` to be positioned against a sub-region of itself; anchors without it fall back to `getBoundingClientRect()`. `a-input` implements it (returns its `.field`), so a menu or tooltip anchored to an `Input` lines up with the field, not the label + hint. Exposed as `anchorRect(el)` in `@antadesign/anta/anta_helpers`.
- **`Input` `type="search"`** — a wrapper-only shorthand that defaults a leading search icon and `clearable` and sets `inputmode="search"`. The native `search` type never reaches the DOM input, so the browser's own affordances stay off; Anta owns that chrome.
- **New icon shapes** — `calendar-days`, `columns-3-cog` (table-configuration), `blank` (a sized invisible spacer for aligning a leading-icon column), `filter-x` (clear/reset a filter), and `heart` (lucide). All as `<Icon shape="…" />` and in the `IconShape` union.

### Fixed
- **`Tooltip`: a tooltip outside an open `Menu` no longer paints over it.** While a menu is open, a tooltip whose anchor is outside the menu system is suppressed — both are top-layer popovers ordered by show time, so it would otherwise cover the just-opened menu (and the top layer can't be reordered with `z-index`). Menu-item tooltips (anchor inside the menu) still show, above the menu; nested menus and the existing same-trigger dismissal are unchanged.
- **`Input` reserves its field box before the element upgrades.** The `.field` box and `<input>` live in the shadow, so a not-yet-upgraded / SSR'd `a-input` showed only its label and the field jumped in on upgrade. `a-input:not(:defined)` now mirrors the shadow `:host` grid and paints a placeholder field box (matching min-height + border, per `size` / `round`), so the field's space is held and there's no layout shift on upgrade.
- **`Input`: leading / trailing / clear adornments stay centered on the first line in `multiline` fields.** A multiline field top-anchored its icons with a fixed 2px offset, so they sat ~4px above where the text's first line sits and jumped up when `multiline` toggled. They now center in a one-line-tall box (`--_lh + 2·--_pad-block`), tracking the first text line at every size — the same vertical position as a single-line field, with no jump.
- **`RadioGroup` `defaultValue` paints its initial selection under eager registration.** `<a-radio>`'s `connectedCallback` re-derived state from the `selected` attribute (which the group never sets) and forced it off after the group had selected the default via the property, so `group.value` was right but no dot painted. `connectedCallback` now only ever turns state on. The seed guard, property/attribute contract, and `:state(selected)` + ARIA reflection now live in one shared `SelectableChildElement` base that both `<a-radio>` and `<a-tab>` extend.
- **A `Button` with only non-text content no longer collapses below its size height.** An icon + `Tag` (or icon + icon) button lost the icon-only `min-height` floor and had no label line-box, shrinking to ~23px at medium. Every button now floors at the matching Input height (24 / 28 / 32); the inline `quaternary` + `paddingless` button opts out.
- **`Select` no longer closes when you press ArrowDown after a mouse open.** The trigger's open-on-ArrowDown handler re-fired and toggled the open menu shut; it now only opens while closed, so ArrowDown falls through into the option list.
- **A `Menu` on an anchor with a smaller `getAnchorRect()` no longer self-dismisses on open.** The position tracker windowed its `IntersectionObserver` to the advertised rect while observing the whole host, so a tall `Input` (label + hint) started below the threshold and closed instantly. It now windows to the observed element's own box.
- **A `Menu` inside an iframe no longer dismisses on open, and a top-level menu again dismisses when its anchor scrolls out of view.** The position tracker picks its observer root by frame context: `null` (viewport) at top level, and the anchor's `documentElement` inside an iframe (where a `null` root resolves against the top-level viewport and windowed the wrong region).
- **A slotted `Input` inside a `Menu` joins the Tab cycle.** The focus trap matched native `input` but not `a-input`, so a slotted field dropped out (Tab from it jumped to the first item). `a-input` is now in the trap.
- **Menu items inside a `MenuGroup` keep the 1px inter-item gap.** The gap lived only on the scroll body, so grouped rows touched. `a-menu-group` now applies the same gap.

### Changed
- **`filter` icon redrawn** — three horizontal bars (was the wider funnel-bars glyph), matching the new `filter-x`.
- **`Button` secondary inset border is fainter** — its `box-shadow` mixes `currentColor` with `transparent 90%` (was `70%`).
- **A read-only `Input` shows a pointer cursor and ellipsizes an overflowing value.** A read-only field is clicked, not typed into, so it reads correctly as the `Select` trigger and a long value renders as `name …`. Editable fields keep the text cursor and the caret-friendly clip.
- **A root `Menu` is never narrower than its trigger** — its `min-width` floors to the anchor's width (`max(--menu-min-width, anchor width)`). Long items still widen it; submenu / context menus are unchanged.
- **`Input` forwards `aria-label` to the internal control**, so a label-less field (like `InputDate`'s time inputs) is announced. A visible `label` still wins.
- **`a-calendar`'s `statechange` no longer bubbles**, matching `a-menu`, so a `Calendar` inside a `Menu` (as in `InputDate`) can't have its selection mistaken for a menu open/close. The wrapper binds the listener on the element directly.
- **A `Menu` opened from within another menu's content nests on top of it instead of replacing it** (e.g. `Calendar`'s year/month jump menu inside `InputDate`'s popover). Selecting a leaf in the nested menu keeps the container open.
- **A `Menu` opens at its selected item** — it scrolls the first `selected` / `aria-checked` / `aria-selected` row into view (and seats keyboard focus on it), matching a native `<select>`. A menu with no such row is unchanged.
- **`MenuItem` renders `children` before `kbd` and the trailing icon**, so a slotted `<Tag>` badge lands before the submenu chevron. Functionally transparent otherwise.
- **`Tag` is normal (mixed) case by default; uppercase is opt-in via `allcaps`.** Text renders as written (`GitHub` stays `GitHub`); `allcaps` restores the uppercase treatment (0.08ch tracking, 1px size step-down). **Breaking, no alias:** drop `nocaps`, add `allcaps` where you want uppercase.
- **Removed `toneText` from `Checkbox` and `RadioGroup`.** Recolour the label + hint in plain CSS with the theme-aware `--text-N-{tone}` tokens (`a-checkbox { color: var(--text-1-critical) }`; target `a-checkbox-hint` / `a-radio-hint` for the hint). The mark-tone axis stays `tone`; `toneSelected` tints only the chosen mark. **Breaking, no alias:** drop `toneText` and any `tone-text` attribute.
- **Anchor-buttons (`<a role="button">`) require a `data-anta` marker to be styled.** The selector is now `a[role="button"][data-anta]`, so Anta no longer styles every page anchor that happens to carry `role="button"`. `<Button href>` adds the marker automatically; hand-authored anchor-buttons must add it. The `<a-button>` element is unchanged.

## 0.3.2 — July 2, 2026

### Added
- **`Tabs` component** (`<Tabs>` / `<a-tabs>` + `<Tab>` / `<a-tab>` + `<TabPanel>` / `<a-tabpanel>`) — a tablist for switching views, built from `<Tab>` children with optional paired `<TabPanel>`s. Registered via the `@antadesign/anta/elements` barrel.
  - **State** — controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`), following the shared `state` contract: a cancelable `statechange` (`detail: { next, prev }`) fires before applying. Post-apply the strip fires a native `change` and exposes a `.value` getter; the wrapper surfaces `onChange(e)` / `onValueChange(e, { value })`, plus `onFocus` / `onBlur`. `<a-tabs>` coordinates; `<a-tab>` is presentational; `<a-tabpanel>` is CSS-only.
  - **No DOM mutation** — the elements never write the DOM. `<a-tabs>` sets each tab's `selected` property (the tab reflects it into `:state(selected)` + `aria-selected`) and scrolls the selection into view; the wrapper renders the `tabindex`, `aria-controls` / `aria-labelledby` wiring, and which panel shows. Hand-assembled markup works too.
  - **`priority`** — `primary` (default) is a raised pill on a recessed track; `secondary` keeps the sizing but drops the track; `tertiary` is a bottom underline with no rest line, marking only the selected tab with a 1px `--tab-selected-text` underline (keeping the same gap + edge inset so labels line up across priorities). The indicator slides between tabs; the label colour snaps.
  - **`tone`** (six named, default `neutral`, or any literal CSS colour, derived in oklch) runs through the whole strip: labels, track well, active fill, pill ring, and the tertiary divider + underline, mapped onto the theme-aware `--text-*-<tone>` / `--border-5-<tone>` tokens. Only the primary pill's fill stays neutral. Plus `size` (`small` / `medium` / `large`, 24 / 28 / 32px) and `orientation` (`horizontal` / `vertical`). Horizontal tabs are content-sized until they overflow, then compress and ellipsize rather than scroll or widen the page.
  - **Sliding indicator** — the pill / fill / underline is one rectangle animated between tabs via CSS anchor positioning: the selected `<a-tab>` carries an `anchor-name` and the strip's `::before` pins to it with `anchor()` + a `transition`, with no JS and no DOM mutation. Strips share one anchor-name isolated per strip by `anchor-scope: all`. Where anchor positioning is unsupported it falls back to a per-tab highlight; `noslide` opts out.
  - **`mounting`** controls inactive `<TabPanel>`s (`display` default, `visibility`, `active`, `lazy`). Each `<Tab>` takes `value` / `label` / `icon` / `iconTrailing` / `disabled`, plus a per-tab `tone` that overrides the strip's for that tab. A `<Tab>`'s text label wraps in `<a-tab-label>` (like `<a-button-label>`) so it carries the baseline nudge and ellipsizes when constrained.
  - **Keyboard** — every enabled tab is its own tab stop; axis-aware arrows move between tabs (wrapping), `Home` / `End` jump to the ends, `Space` / `Enter` activate. Disabled tabs are skipped.
- **`Tooltip` `truncatedOnly`** (`truncated-only` attribute) — shows the tooltip only when its target's text is ellipsized; a label that fits gets none. The truncation check is a layout read (`scrollWidth`/`clientWidth`), re-measured on each show. It measures the nearest Anta ellipsizing label part (`<a-tab-label>` / `<a-button-label>`), then the anchor; `truncatedSelector` overrides which element is measured.

### Removed
- **Dropped `priority` from `Checkbox` and `RadioGroup`** (and the `priority` attribute on `<a-checkbox>` / `<a-radio>` / `<a-radio-group>`, plus the per-option `priority`). Every checkbox / radio is the filled `primary` look. To reproduce the outlined `secondary` look, use plain CSS on the light-DOM `::before` (box/ring) + `::after` (glyph/dot) per `:state(...)`; see the checkbox / radio docs Styling section.

### Changed
- **`Checkbox` / `RadioGroup`: `tone` colours only the mark, not the text.** `tone` tints the checked fill / selected ring + dot and the unselected box/ring border; the label and hint stay neutral. A new `toneText` prop colours the label + hint independently (same set, or any CSS colour). Custom colours flow through `--{checkbox,radio}-tone-source` for the mark and a new `--{checkbox,radio}-tone-text-source` for the text.
- **Renamed `onAnyChange` → `onValueChange`** on `Input`, `Checkbox`, and `RadioGroup` (`Tabs` ships with the new name), following the Radix / Base UI convention. The old name read as "any event" and was mistaken for including focus/blur, which it never did. Signature unchanged. **Breaking, no alias:** rename every `onAnyChange`.
- **Tabular figures by default.** Numbers render as tabular (fixed-width) figures so digits align. `tnum` is added to the global `--sans-serif` default and to every component that re-declares `font-feature-settings` (`Button`, `Input`, `Checkbox`, `RadioGroup`, `Tabs`, `Text`, `Title`). A re-declaration replaces the property, so the default is restated wherever a component sets its own sets; existing `ss02` / `ss05` are preserved.
- **`Button` publishes `role="button"`.** The `<a-button>` element has no implicit ARIA role, so assistive tech announced it as generic and its `aria-pressed` was invalid. The wrapper now sets `role="button"` on the element and the `<a href>` variant (a consumer's own `role` still wins). No visual change.

### Fixed
- **`Tooltip`: an empty tooltip no longer opens a blank bubble.** With no element children and no non-whitespace text, it doesn't open. Checked on every show, so late-populated content works. An icon-only bubble still shows.
- **`Expander` header uses Anta's focus ring.** The summary `<button>` showed the browser default outline; it now uses the standard ring (`1px solid var(--focus-ring)`, flush at `0` offset).

## 0.3.1 — June 26, 2026

### Added
- **`MenuItem` `value` prop** — an opaque value (`string | number`) handed back in `onSelect`'s detail, so one handler can tell which row was chosen without a per-item closure.
- New **`share`** icon shape (lucide), as `<Icon shape="share" />` and in the `IconShape` union.

### Changed
- **`MenuItem`: `onSelect` now receives `(event, { value, label })` and only fires for a genuine selection.** Existing `(event) => …` handlers keep working. It no longer fires for a submenu parent (opening the flyout isn't a selection) nor for a selection bubbling up from a nested submenu. Disabled items still never fire.
- **`Menu`: submenus open on hover by default; `hover` is replaced by `nohover`.** Hovering a submenu parent opens the flyout (with intent timing) as well as clicking it. Pass `nohover` for click-only. **Migration:** drop `hover` (now the default); add `nohover` where you want click-only. Submenu-only, and hover-intent is mouse-only (see Fixed).
- **`Menu`: opening dismisses a tooltip on its trigger**, so it doesn't linger over the just-opened surface (via the tooltip's own `hide()`).

### Fixed
- **`Menu`: opening no longer closes the menu instantly, and dismiss-on-scroll is anchor-aware.** A raw page-scroll listener used to dismiss the menu, so the open nudge (the browser scrolling the just-focused first item or the just-clicked trigger into view, amplified under `scroll-behavior: smooth`) tripped it on open. Dismiss-on-scroll now rides an `IntersectionObserver` on the trigger: the menu closes once the trigger scrolls more than ~half its own size out of its open position. That reacts to the anchor moving for any reason, scales to the trigger, and never self-dismisses from the open nudge. The first item is focused with `preventScroll`.
- **`Menu`: hover submenus no longer close immediately on touch.** The synthetic `mouseleave` a tap emits fired the hover-close timer. Hover-intent is now mouse-only; on touch and pen the submenu opens on tap and stays open until dismissed or a sibling opens.

## 0.3.0 — June 25, 2026

### Added
- **`Checkbox` component** (`<Checkbox>` / `<a-checkbox>`) — a tri-state checkbox (`checked` / `unchecked` / `indeterminate`), form-associated. Controlled (`checked` + `onStateChange`) or uncontrolled (`defaultChecked`), following the shared `state` contract: a cancelable `statechange` (`detail: { next, prev }`) fires before applying, with `state` / `default-state` attributes and `:state(checked)` / `:state(indeterminate)` hooks. Post-apply the element fires a native `change` and exposes `.checked` / `.indeterminate`; the wrapper surfaces `onChange(e)` and `onAnyChange(e, { checked, indeterminate, name, value })`, plus `onFocus` / `onBlur`. `default-state` re-seeds the value until first interaction. Visual state lives on `ElementInternals`; the wrapper supplies `role` / `aria-*` and derives `aria-label` from `label` / `children`. `tone` (six named, default `neutral`, or any literal CSS colour) tints the whole control; `size` (`small` / `medium` / `large`) scales the box and the label + hint type; `priority` (`primary` / `secondary`), where `secondary` is an outlined look that leaves the box unfilled and draws the border + checkmark in the tone. Optional `label` + `hint`, form `name` / `value`. Registered via the `@antadesign/anta/elements` barrel.
- **`RadioGroup` component** (`<RadioGroup>` / `<a-radio-group>` + `<a-radio>`) — a single-select radio control, Anta's first form-associated group element. `RadioGroup` is the whole API: pass an `options` array (`{ value, label, disabled?, tone?, size? }`) and it renders one `<a-radio>` per entry. There is no standalone `Radio` component; options are data. Registered via the `@antadesign/anta/elements` barrel.
  - **State** — controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`): a cancelable `statechange` fires before applying. Post-apply the group fires a native `change` and exposes `.value`; the wrapper surfaces `onChange(e)` / `onAnyChange(e, { value, name })`, plus `onFocus` / `onBlur` wired to `focusin` / `focusout`. `<a-radio-group>` coordinates; `<a-radio>` is presentational.
  - **No DOM mutation** — the elements never write the DOM. The group sets each radio's `selected` property (reflected into `:state(selected)` + `aria-checked`), submits through `ElementInternals`, and tracks focus with `aria-activedescendant`. The roving `tabindex` is rendered declaratively by the wrapper. Hand-assembled markup works too.
  - **Forms** — give the group a `name` and the selected option's `value` submits like a native radio group; reset restores the `defaultValue`.
  - **Variants** — `tone` (six named, or any literal CSS colour) tints the whole option; `size` (`small` / `medium` / `large`) scales the control and the label + hint type, cascading to every option; `priority` (`primary` / `secondary`); `orientation` (`vertical` / `horizontal`) sets layout + arrow axis; `disabled` per option or group; `status` recolours the group hint. Named tones track light/dark; a custom colour keeps its hue + chroma and pins lightness to the brand curve (same derivation as `Checkbox`).
  - **Accessibility** — `role="radiogroup"` on the group, `role="radio"` per option, the visible `label` wired via `aria-labelledby`. Follows the [WAI-ARIA radio-group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
  - **Structure** — no shadow DOM: an optional header (`<a-radio-group-label>` + optional `<a-radio-group-hint>`) above an `<a-radio-list>` of `<a-radio>` options, each wrapping its text in `<a-radio-label>` and an optional `<a-radio-hint>`. Plain light-DOM children laid out by `a-radio-group.css`, so gap / grid / wrap restyle with ordinary CSS.
  - **Styling hooks** — `--radio-*` tokens (size, ring/fill per state, focus, disabled) and the `:state(selected)` custom state.
- **`Text` `collapsible` prop** — paired with `expandable`, the chevron becomes a two-way "Show more" / "Show less" toggle that stays visible while expanded. Without it, expanding stays one-way. Takes effect only with `expandable` (the type forbids it otherwise).
- New `circle-dot` and `square-check-big` icon shapes (lucide).
- **`Input` `name` getter** — `el.name` mirrors the `name` attribute (like native `<input>.name`), so it works in validation loops keyed by field.

### Changed
- **Dropped the per-component focus-ring tokens (`--button-focus`, `--input-focus`, `--menu-item-focus`); the ring uses the global `--focus-ring` directly.** Each only aliased `--focus-ring`, so the ring is visually unchanged; retune it via the global token (or, per instance, a wrapping rule / `::part`). Setting the old token has no effect. (`Checkbox` / `RadioGroup` already used `--focus-ring` directly.)
- **`Progress`: full named-tone set + custom tones.** `tone` now accepts `brand` / `info` / `success` / `warning` / `critical` (was only `info`), each re-pointing track / indicator / text to the matching role tokens, plus any literal CSS colour (derived in oklch). The fill is exposed as `::part(indicator)`.
- **`Menu`: the popover surface is exposed as `::part(menu)`** — style its chrome with plain CSS instead of the `--menu-*` properties.
- **`Menu`: opens a touch faster** — the enter transition is 100ms (was 140ms); the exit stays 140ms, so it opens snappy and dismisses unhurried.
- **`Input`: custom-accent `tone` prop** — any literal CSS colour tints the resting / hover border (an oklch derivation); `status` still wins for validation.
- **`Expander`: the slotted title inherits its colour from `::part(summary)`**, so `::part(summary):hover` / `:active` restyle the title's colour directly. The `--expander-text-hover` knob still works. Minor behaviour change: a custom title with no explicit `color` now inherits the hover recolour (set `color` on it to opt out).

### Fixed
- **`Expander`: no flash of open body content before upgrade.** A closed-by-default expander painted its body open during the pre-`:defined` window, then snapped shut. The element CSS now hides the body while `a-expander:not(:defined)` and reveals it only when the SSR markup says open, so closed expanders render collapsed from first paint. `:defined` then drops the guard.
- **`Expander`: no flash of the header on upgrade.** Before upgrade the light-DOM title sat flush with no chevron, then jumped when the shadow header took over. The `:not(:defined)` summary now gets the same gutter padding and a placeholder chevron, so the resting header looks identical before and after.
- **`Button`: a `loading` button no longer activates from the keyboard.** Loading buttons leave the tab order (`tabindex="-1"`), and Enter/Space + click delegation bails while `loading` (or `disabled`); the previous `pointer-events:none` guard was mouse-only.
- **`Button`: holding Enter no longer fires repeated activations** — the handler ignores OS key-repeat (`e.repeat`).
- **`Button`: submit buttons run form validation and fire `submit`** — the submit path always uses `form.requestSubmit()` (the old `form.submit()` fallback skipped validation and the `submit` event).
- **`Button` / `Menu`: Enter/Space activation works in an iframe** — the delegated handlers bind to the element's own `ownerDocument` instead of the module-global one, so activation and form submit/reset work cross-frame.
- **`Progress`: screen readers no longer announce an out-of-range value** — `aria-valuenow` is clamped to `[0, max]` (and `aria-valuemin="0"` set).
- **`Menu`: a nested `<Menu>` works as a submenu without the `submenu` prop.** Submenu detection is now structural: any `<Menu>` nested inside a `<MenuItem>` is a flyout. (`submenu` is still recommended for the chevron, `aria-haspopup`, and the `aria-expanded` baseline.)
- **`Menu`: re-triggering an open `context` / `coord` menu repositions instead of closing.** A second right-click quietly moves it; the old close-then-reopen emitted a spurious `statechange('closed')` that dismissed a controlled menu.
- **`Menu`: a keyboard-opened `coord` menu no longer appears in the top-left corner** — it positions at the trigger's box (a keyboard click reports `0,0`).
- **`Menu`: no longer writes `aria-expanded` onto a root menu's trigger** — that trigger is a consumer-owned sibling, so mutating it broke the "never mutate foreign DOM" rule. Add `aria-haspopup="menu"` to your trigger; the menu is still announced and Esc-dismissable. Submenu parents still reflect `aria-expanded`.
- **`Menu`: keyboard-nav edge cases.** `Shift`+`Tab` from a non-item focus steps to the first item instead of wrapping to the last; type-ahead matches an item's own label, no longer folding in a `kbd` hint or a submenu's text.
- **`Tooltip`: cursor-follow positioning no longer thrashes layout** — a burst of `mousemove`s within one frame coalesces to a single measure + position (latest cursor wins), and a wiring edge case that could leave a tooltip unable to show is fixed.
- **`Tag`: an icon-only tag has an accessible name** — it derives `aria-label="<shape> tag"`; pass your own to override.
- **`Text`: `truncate={0}` (or negative) no longer hides the text** — zero/negative now means "no truncation".
- **`Text`: an unrelated re-render no longer collapses expanded text** — expanded state lives on the element and resets only when the truncation/expandability changes. Also fixes the stale "Show more" label / `aria-expanded`.
- **`Input`: dropping the controlled `value` no longer empties the field** — removing the `value` attribute keeps the current text, matching a native input.
- **`Input`: dynamic constraint changes update validity immediately** — toggling `required` / `pattern` / `min` / `max` / `step` / `minlength` / `maxlength` re-runs validity without waiting for a keystroke.
- **`Input`: `status="critical"` set at mount paints `:state(invalid)` on first render** (server-rendered error fields).
- **`Input`: a `<form>` reset re-syncs a controlled field** — the element fires `input` + `change` on reset, so a controlled consumer's state follows.
- **`Input`: `<fieldset disabled>` / a disabled form visually disables the field** — styling keys off `:disabled`, and re-enabling a fieldset no longer overrides a field's own `disabled`.
- **`Input`: the clear button's `clearclick` veto works under React** — the wrapper routes `onClearClick` / `onClearInput` through the cross-renderer event unwrap, so `event.preventDefault()` reaches the native event and `event.detail` is defined.
- **`Input`: toggling `multiline` mid-edit keeps focus + caret** — the input↔textarea rebuild restores focus and the selection range.

## 0.2.3 — June 18, 2026

### Added
- **`Expander` component** (`<Expander>` / `<a-expander>`) — a collapsible disclosure (a header that toggles a content region). Built on a real `<button>` summary + a grid content region (no native `<details>`), following the WAI-ARIA disclosure pattern with full keyboard support; collapsed content is `inert`. Registered via the `@antadesign/anta/elements` barrel.
  - **State** — uncontrolled (`defaultOpen`) or controlled (`open` + `onStateChange`): a cancelable `statechange` (`detail: { next, prev }`), `state` / `default-state` attributes, and the `:state(open)` hook.
  - **Title** — `title` takes a string or a node; `level` (1–6) applies the `<Title>` scale to a string, or pass a `<Title>` for real heading semantics.
  - **Surface** — `priority` (`secondary` default / `primary` / `tertiary`) and `tone` (named tones or any literal CSS colour) tint the fill and text, tracking light/dark; a closed header lightens on hover.
  - **Header** — `actions` renders controls at the end of the header, outside the toggle (separately focusable; the title ellipsizes first). `disabled` freezes the header. `outdent` (with `tertiary`) sets the title + body flush with surrounding content.
  - **Styling hooks** — `--expander-gutter` plus `--expander-text` / `--expander-text-hover` / `--expander-bg` / `--expander-border`; the `::part(summary | actions | content)` parts; and the `:state(open)` state.
- **`Input` component** (`<Input>` / `<a-input>`) — a text field. The real `<input>` / `<textarea>` lives in shadow DOM, so focus, IME, autofill, and native form participation (via `ElementInternals`) all work, and the control is reachable through `::part(input)`. Registered via the `@antadesign/anta/elements` barrel. Anta's first stateful, form-associated element.
  - **Value** — controlled (`value` + `onChange`/`onInput`) or uncontrolled (`defaultValue`); the controlled value reflects only when it differs, so the caret survives re-renders. Submits under `name`, with `formResetCallback` / validity wired through `ElementInternals`.
  - **Label, message & status** — `label` and `hint` take strings or React nodes (`hint` is the single message channel). `status` (`critical` / `warning` / `success` / `info` / `brand`) tints the border + `hint` from that tone's role tokens and prefixes a glyph; only `critical` marks the field invalid (`aria-invalid`, blocks submission, `:state(invalid)`), the rest are advisory. Each status has a default glyph (critical→`warning-diamond`, warning→`warning-triangle`, success→`circle-check`, info→`info`, brand→`circle-small-solid`); override with `statusIcon`, or drop it with `statusIcon={false}`. The element mirrors the label and message into the shadow control's `aria-label` / `aria-description` (IDREFs can't cross the shadow boundary).
  - **Multiline** — `multiline` renders a `<textarea>`; with no `rows` it autogrows from one line (CSS `field-sizing` where supported, a JS resize on Firefox / older Safari), capped by `maxRows`; a fixed `rows` count gives a constant-height box.
  - **Slots & clear** — `leading` / `trailing` paste content flush at the field edges; `clearable` adds a keyboard-focusable `<a-button>` in the `clear` slot that fires a bubbling `clearrequest` trigger, which the element turns into a two-hook clear lifecycle (so it works before hydration): a cancelable `clearclick` (`onClearClick`, `preventDefault()` keeps the value), then the clear (empties, fires `input`/`change`, refocuses) and `clearinput` (`onClearInput`). Bind them on a raw `<a-input>` as lowercase `onclearclick` / `onclearinput`. Browser-injected affordances are suppressed (no `type="search"`; native search/number/reveal decorations reset). An Anta `<Tooltip>` attaches by being dropped in as a plain child, projected into a default slot under the field.
  - **Sizes** — `small` (24px) / `medium` (28px) / `large` (32px), each the height of the matching `Button` size, with the type scale and icon tracking the size (small 13/16 + 14px icon; medium 15/20 + 16px; large 17/24 + 18px). The border is an inset `box-shadow`, so width changes never reflow.
  - **Events** — `onInput` (per keystroke) and `onChange` (on commit) carry native timing; `onAnyChange(event, attrs)` unifies them (plus clear) with an `attrs` snapshot (`value`/`name`/`empty`/`valid`/`validationMessage`). `onFocus`/`onBlur` and any other DOM handler are forwarded on both `<Input>` and the raw `<a-input>`. `autocomplete` and `inputmode` derive from `type`, overridable via `autoComplete` / `inputMode`.
  - **Disabled** — the control is disabled, value/label dim to `--text-4`, the hint to `--text-5`, slotted content to 50% + non-interactive.
  - **Styling hooks** — `--input-*` tokens are colour-only; every dimension is a fixed internal literal. Plus `::part(field | input | label | leading | trailing | clear | hint)` and the `:state(filled)` / `:state(invalid)` states.
  - **Layout** — label / field / hint are a grid on the host (single column by default), each a part. Re-template the grid from your own CSS (label-on-the-left, a shared label column via `grid-template-columns: subgrid`, wrapping multi-column layouts). The element's defaults are in `@layer anta`, so your rule wins.
- **New icon shapes** — `eye`, `eye-closed`, `text-cursor-input` (lucide), `circle-small-solid` (a filled dot), and `warning-diamond`. `warning-diamond` is the default `critical`-status glyph and `circle-small-solid` the default `brand`-status glyph on `Input`.
- **`Menu` component** (`<Menu>` / `<a-menu>`) with `MenuItem`, `MenuSeparator`, and `MenuGroup` — a dropdown / context menu that anchors to any target: place `<Menu>` right after the trigger (its previous sibling) and it opens on click, positions itself with room-aware flipping + viewport clamping, and dismisses on outside-click, <kbd>Esc</kbd>, or scroll. Rows are dedicated `<a-menu-item>`s composing a leading `icon`, a `label` (or `children`), a trailing `kbd` hint, and an optional trailing icon; `tone="critical"` styles a destructive action, `disabled` greys one out. Submenus are first-class: pass a nested `<Menu submenu>` for a chevron + flyout that opens to the side (flipping near the edge) on click, or on hover with intent timing via `hover`. Trigger modes: click (default), right-click via `context`, open-at-cursor via `coord`. Close contract: selecting a `MenuItem` closes the menu, but injected content (a slider, an input) doesn't; opt an item, a `MenuGroup`, or any container out of closing with `data-menu-open`, or close from custom content with `data-menu-close`. Open state follows the shared `state` contract: uncontrolled by default (observe with `onStateChange` or the raw cancelable `statechange`, or call `.open()` / `.close()` / `.toggle()`), or controlled via the `open` prop (the `state` attribute), applying `detail.next`. Full keyboard support (↑/↓, Home/End, type-ahead, →/← for submenus, <kbd>Enter</kbd>/<kbd>Space</kbd>, <kbd>Esc</kbd>, <kbd>Tab</kbd> cycles within the menu). Renders in the top layer via the Popover API; positioning is JS-based and realm-aware (works inside an iframe). Exposes `--menu-bg`, `--menu-border`, `--menu-radius`, `--menu-shadow`, `--menu-padding`, `--menu-min-width`, `--menu-backdrop-filter`, and item-level `--menu-item-*` tokens. Registered via the barrel or granularly (`@antadesign/anta/elements/a-menu`).
- New `square-menu` icon shape (lucide).
- **`Tag` gains a `priority` axis** (`secondary` default / `primary` / `tertiary`), matching the Figma `component/tag/*` set. `secondary` is the alpha-tint fill; `primary` is a solid fill with white text; `tertiary` is a transparent outline. Each tone declares three hue anchors the priority maps to: `--tag-tint` (secondary fill + secondary/primary border), `--tag-fill` (the solid primary fill), and `--tag-edge` (the tertiary outline, `= --text-2-{tone}`). Custom tones derive all three with pinned oklch lightness/chroma.

### Changed
- **New global `--focus-ring` token; the focus-ring colour is unified (and brightened in light mode).** The colour was duplicated as per-component literals (`--button-focus` / `--input-focus` / `--menu-item-focus` / `--checkbox-focus`, all `#503cb4` light · `#a897fc` dark). It's now a single themed global token, `--focus-ring` (light `oklch(0.55 0.2 284.15)`, a touch brighter; dark unchanged), that each `--{component}-focus` points at. Retune everywhere via `--focus-ring`, or a single control via its `--{component}-focus`.
- **`Button` typography and icons scale with `size`.** `small` / `medium` / `large` move from a fixed 15px font to the 13/16 · 15/20 · 17/24 scale (matching `Text` and the same-size `Input`), and a leading/trailing icon tracks the size (14 / 16 / 18px). Heights unchanged (24 / 28 / 32px). Override per instance via `<a-button-label>`'s `font-size`/`line-height` or an explicit `<Icon size>`.
- **`Text` / `<a-text>` sets `text-wrap: pretty`**, evening out widows/orphans on multi-line body copy (headings use `text-wrap: balance`). Only the non-truncated case is affected.
- **Tag tones are now translucent alpha tints (the Figma "secondary" spec).** Each tone's fill and hairline border are alpha tints of a per-tone hue rather than an opaque `--bg-4-{tone}`: light fill ~10% (neutral ~7%), border ~15%; dark deepens to ~20% / ~25%. Tone text uses `--text-3-{tone}` (was `--text-2-{tone}`). Neutral's tint is a plum-gray that flips light↔dark. A new `--tag-tint` holds that hue (set it alone to re-tint fill + border together); `--tag-bg` now defaults to a tint of it (was solid `--bg-4`) and `--tag-border` derives from it at ~15–25%. Custom tones follow the same recipe. `--tag-text` / `--tag-bg` / `--tag-border` / `--tag-separator` stay overridable.
- **Tooltip shadow DOM is one level flatter.** The bubble surface is the `<slot>` itself (styled `display: block`) rather than a `<div>` wrapping a slot. No API change: `::part(bubble)` now resolves to the slot, the `--tooltip-*` tokens and behaviour are identical. Verified across Chromium, Firefox, and Safari/WebKit.

## 0.2.2 — June 13, 2026

### Breaking
- **`list-detail-view` icon renamed to `list-collapse`** (and restyled to lucide `list-collapse`). The old filled detail-view glyph is gone. Migration: rename `shape="list-detail-view"` → `shape="list-collapse"`.
- **Tooltip is pinned under the anchor by default; cursor-following is opt-in via `follow`.** It now pins beneath the anchor (matching Material, shadcn, Carbon, Polaris). Pass `follow` for cursor-tracking, which trails the pointer and fades by distance from the anchor (full within ~10px, transparent by ~100px). **The `static` attribute / prop is removed** — pinning is the default, so drop it; add `follow` where you relied on following. `interactive` is always pinned (it ignores `follow`).

### Added
- **`--tooltip-padding`** token (defaults to `4px 8px`).
- **Tooltip `::part(bubble)`** — the bubble surface is a shadow part, so consumers style it directly (`a-tooltip::part(bubble) { … }`) for what the `--tooltip-*` tokens don't cover.

### Changed
- **`copy` icon is rotated a quarter-turn** — it ships rotated 90° by default (the common orientation), so consumers drop the per-use `transform: rotate(90deg)`.
- **`filter` icon restyled to lucide `list-filter`** — the three-line stroked glyph (was a filled three-bar). Same name, no API change.
- **Quaternary buttons are full-weight and full-opacity at rest** — `priority="quaternary"` now uses `font-weight: 400` (was `415`), `letter-spacing: 0.06ch`, and a full-opacity rest foreground (the 0.2.0 90%-alpha rest fade is removed), so the label sits at the tone's full strength.
- **`Button`, `Text`, and `Title` pin Anta's stylistic sets explicitly** — they declare `font-feature-settings: 'ss02', 'ss05'` themselves (matching the `:root` default) rather than relying on inheritance, so a consumer's own `font-feature-settings` on an ancestor can't drop them (the property replaces, it doesn't merge).

### Fixed
- **Button ignores empty / whitespace-only / `NaN` children instead of wrapping them.** It drops children with no visible content (`""`, whitespace, `NaN`) rather than emitting a blank label. `null`, `undefined`, and booleans render nothing; element children pass through unwrapped; a valid `0` still renders.
- **Button icon padding no longer miscounts a `<Tooltip>` child.** A `<Tooltip>` is invisible but was counted by the `:first-child` / `:last-child` / `:only-child` selectors that drive icon padding, so an icon-only button with a tooltip lost its square padding. Those selectors now discount `a-tooltip` in any position.

## 0.2.1 — June 10, 2026

### Changed
- **Secondary buttons: inset hairline edge.** The `secondary` edge is now an inset hairline (`box-shadow: inset 0 0 1px color-mix(in oklch, currentColor, transparent 70%)`, was a non-inset `0 0 1px` at `transparent 50%`). Softer and contained within the chip.
- **Button loading overlay is subtler** — `--button-loading-opacity` lowered from `0.25` to `0.15`.
- **Table borders use `--border-4`** — raw `<table>` row separators and the `data-bordered` frame + column dividers use `--border-4` (was `--border-5`), a touch stronger. Both still in `@layer anta`.
- **Monospace text carries no letter-spacing** — the reset sets `letter-spacing: 0` on `code, kbd, samp, pre`, so a global `letter-spacing` no longer loosens code.

### Packaging
- **Published CSS is minified** — `build:css` runs the shipped CSS through esbuild (`--minify`), stripping comments and collapsing whitespace. Identical rendering; source and dev builds keep readable CSS.

## 0.2.0 — June 9, 2026

### Added
- **`Tag` component** (`<Tag>` / `<a-tag>`) — a compact uppercase pill for status, labels, and metadata. CSS-only (no JS, no shadow DOM) like `<Title>`; tone, size, and case are plain attributes. Content composes from `icon` / `iconTrailing`, `label`, and `value` (like `<Button>`): `value` is the primary text and `label`, when paired with a value, renders as a bold key before it (a lone label is treated as the primary text). Raw `children` give a segmented tag: each segment after the first gets a hairline divider (a leading icon stays flush). `tone` takes the five named tones, defaulting to a neutral gray, or any literal CSS colour (hue kept, lightness/chroma pinned to the named-tone curve via `oklch(from …)`, re-tuned for dark mode). Named tones source `--text-2-{tone}` / `--bg-4-{tone}`. `size` `small` / `medium` / `large` (16 / 20 / 24px); `nocaps` opts out of the default uppercase. Height is intrinsic; tabular figures + `ss05` numerals are always on. Exposes `--tag-text`, `--tag-bg`, `--tag-border`, `--tag-separator`, `--tag-padding-block`, `--tag-padding-inline`, `--tag-gap`, `--tag-icon-size`, `--tag-label-weight`. Registered via the `@antadesign/anta/elements` barrel.
- New `tag` icon shape (lucide), with synonyms `label` / `badge` / `chip`.

### Breaking
- **Stickers extracted to a separate package, `@antadesign/stickers`.** All sticker code and artwork moved out of `@antadesign/anta`, and with it the `lottie-web` dependency. Removed here: the `Sticker` / `StickerAnimated` components and types, the `<a-sticker>` / `<a-sticker-animated>` elements, and the `@antadesign/anta/stickers`, `@antadesign/anta/stickers/*`, and `@antadesign/anta/generate-stickers.mjs` subpaths. Apps that don't use stickers no longer install `lottie-web`. Migration: `npm install @antadesign/stickers` (it depends on `@antadesign/anta` + `lottie-web`) and change imports (`@antadesign/anta/stickers` → `@antadesign/stickers`; add `@antadesign/stickers/elements` for the tags). The component API and generator are unchanged.

### Changed
- **`<Text>`'s default `priority` is now `secondary` (was `primary`).** A plain `<Text>` renders one step softer (`--text-2` instead of `--text-1`), so default body text isn't the strongest foreground. `primary` is the explicit opt-in for `--text-1`; `tertiary`–`quinary` are unchanged. Migration: add `priority="primary"` where you relied on the old default.
- **Selected buttons gain an inset ring** — `selected` adds `box-shadow: inset 0 0 0 1px currentColor` (up from 0.5px) on top of the pressed/active look, declared after the priority blocks so it survives their `box-shadow` cancels.
- **Secondary buttons gain a hairline edge** — the `secondary` priority carries `box-shadow: 0 0 1px color-mix(in oklch, currentColor, transparent 50%)`. `primary`, `tertiary`, and `quaternary` cancel it.
- **Secondary button rest labels darkened slightly (light mode)** — the rest foreground shifts down `0.05` in oklch lightness via the `--button-fg-secondary-l-shift` knob, covering every tone. Hover / active unchanged; dark mode zeroes the shift.
- **Quaternary button labels are slightly heavier** — `priority="quaternary"` sets `font-weight: 415` (vs the `450` default) so the faded text holds up at its lower opacity.
- **Quaternary buttons read quieter than tertiary** — the rest foreground is the tone at 90% alpha, so it's distinct from full-opacity tertiary (they used to look identical at rest). Hover / active restore full opacity.

### Fixed
- **An empty `tone` on a button no longer renders it invisible.** A `tone=""` matched the custom-tone branch by attribute presence, where the empty value resolved to `transparent`. Both the wrapper and element now treat an empty `tone` as no tone: `<Button>` omits the attribute, and the element CSS excludes `[tone=""]`.

## 0.1.1-dev.8 — June 5, 2026

### Added
- **`Tooltip` component** (`<Tooltip>` / `<a-tooltip>`) — a small floating bubble placed as a child of the element it describes; it doesn't affect that element's layout and its content can be anything (slotted light DOM). Shows on hover (after `delay`, default 250ms) and keyboard focus (gated on `:focus-visible`); dismisses on mouse leave, blur, <kbd>Esc</kbd>, or when the anchor scrolls away. On touch it opens on press-and-hold (~500ms) and lingers ~1.5s after the finger lifts; a quick tap never shows it. Follows the cursor by default; pass `static` to pin it under the anchor, or `interactive` to make the bubble hoverable + clickable (implies `static`). `placement="top" | "bottom"` (default `bottom`) auto-flips. Renders in the top layer via the Popover API; one shows at a time, with a short close delay so moving between anchors cross-fades. Exposes `--tooltip-bg`, `--tooltip-shadow`, `--tooltip-border`, `--tooltip-backdrop-filter`, `--tooltip-radius`, `--tooltip-max-width`. The bubble gives slotted content a normalized text baseline (Anta body typography) so the anchor's own styling doesn't bleed in.
- **Granular element registration / smaller bundles.** Each element imports on its own — `import '@antadesign/anta/elements/a-tooltip'` registers just that element and loads its CSS, pulling in only that element's code. A tooltip- or button-only app no longer ships `lottie-web` (which only `a-sticker-animated` needs). The barrel is unchanged: `import '@antadesign/anta/elements'` registers everything.

### Dependencies
- Added [`es-toolkit`](https://es-toolkit.dev) (`1.47.0`) as a runtime dependency, imported with named tree-shakeable imports, so bundlers include only what's used (currently just `debounce`, in `<a-tooltip>`).

### Fixed
- **Anchor-buttons (`<Button href>` / `<a role="button">`) no longer pick up link colour + underline** from the global link reset. `a:link` / `a:visited` have the same `(0,1,1)` specificity as `a[role="button"]` and won on source order. The reset's link selectors now exclude `[role="button"]` (`a:not([role="button"])…`). Affects `reset.css`.
- **Button & link `:hover` styles no longer stick after a tap on touch devices.** Hover-only appearance changes are gated behind `@media (hover: hover) and (pointer: fine)`, so on touch a button or link returns to its rest state after a tap. `:active` / `[selected]` press feedback is unchanged. Affects `a-button.css`, `reset.css`, `a-text.css`.

## 0.1.1-dev.7 — June 3, 2026

### Added
- **`Button` component** (`<Button>` / `<a-button>`) — five named tones (`neutral` default / `brand` / `info` / `success` / `warning` / `critical`) plus any literal CSS colour; four priorities (`primary` / `secondary` / `tertiary` / `quaternary`); three sizes (`small` / `medium` / `large`); `icon` / `trailingIcon`, `label`, `loading`, `selected`, `disabled`, `paddingless`; anchor mode via `href`. Registered via the `@antadesign/anta/elements` barrel.
- New `rotate-ccw` icon shape (lucide).

### Breaking
- **Background tokens renamed to a numeric elevation scale.** The named properties become `--bg-1 … --bg-5` (1 = deepest / recessed, 5 = most raised): `--bg-section`→`--bg-1`, `--bg-base`→`--bg-2`, `--bg-pane`→`--bg-3`, `--bg-block`→`--bg-4`, `--bg-spot`→`--bg-5`. Tinted variants follow the number (`--bg-base-info`→`--bg-2-info`). `--bg-1` is neutral-only. Values unchanged; `--text-1…5` and `--border-1…5` unaffected. No back-compat aliases (prerelease). Migration: rename `var(--bg-base)`→`var(--bg-2)` and so on, or alias the old names in your own `:root`.
- **`<Button>`'s `iconButton` prop is removed and `leadingIcon` is renamed to `icon`.** Icon-only behaviour is structural: pass `icon` with no `label` / `trailingIcon` / `children`, and `a-button:has(> a-icon:only-child)` gives the square padding + min-size pin. Migration: `<Button iconButton leadingIcon="check" />` → `<Button icon="check" />`; `<Button leadingIcon="check" label="…" />` → `<Button icon="check" label="…" />`. `trailingIcon` is unchanged.

### Changed
- **Button sizes grew 2px taller.** Vertical padding gained 1px top and bottom (and 1px each side to match), so the default `medium` button is 28px (was 26): `small` 22 → 24, `medium` 26 → 28, `large` 30 → 32. `padding-y` is 3 / 5 / 7 and text-edge `padding-x` 7 / 9 / 13; icon-edge padding stays text-edge − 2px. Icon-only squares track the same heights. Font size and the 18px label line-box are unchanged.
- **Dark theme palette retuned.** Every dark-mode background and border token (neutral plus the five tinted tones) was reworked into hand-tuned `hsl()` values, deepened from the 0.2 baseline so dark surfaces read with less glare. Light mode and dark text tokens are unchanged.
- **Raw `<code>` sets `line-height: 1em`** (in `reset.css`, `@layer anta`) so inline code no longer inflates the prose line box.
- **Neutral secondary button background retuned.** Light mode evens the rest→hover→active ramp (active drops ~20% → ~15% alpha), giving ~7 → 10 → 15% instead of 7 → 10 → 20. Dark mode is ~11 → 14 → 18%. Other tones unchanged.
- **Dark neutral `--bg-2` / `--bg-1` adjusted** (post-rename). `--bg-2` lightened to `hsl(280 10% 5.5%)` and `--bg-1` set to near-black `hsl(280 20% 0%)`, so the deepest surface sits below the page base in lightness (elevated / code surfaces read recessed). `--bg-4` / `--bg-5` were also nudged; `--bg-3` and the tinted tones are unchanged. (Later converted from `hsl()` to hex.)
- **Dark tinted button fills bumped (secondary, tertiary, custom).** The five named tinted tones step their dark secondary fill to 23 → 28 → 33% alpha (from ~15 → 20 → 25%); tertiary hover/active move to 23 → 28%. Custom tones get the same ramp via `--_tone-bg-a-*` (`0.23 / 0.28 / 0.33`). Neutral secondary rest steps to ~11% (~11 → 14 → 18%, tertiary ~8 → 13%).
- **Loading stripe animation sped up** — `--button-loading-duration` default `1s` → `0.5s`.
- **Link hover no longer repaints the underline colour** — `a:hover` only thickens the underline (0.5px → 1px), keeping its resting hairline colour instead of switching to `--link-color-hover`.
- **Quaternary button press feedback (light mode)** — `:active` lightens the rest foreground by `0.05` in oklch lightness for a subtle pressed look. Dark mode is unchanged (lightening would brighten the already-light foreground).
- **Button label `font-weight` softened from `500` to `450`** across every priority and size.
- **Boolean button attributes render as presence, not `="true"`.** `<Button>`'s `selected` / `disabled` / `loading` / `paddingless` emit a presence attribute (`disabled=""`), and the element CSS matches by presence (`a-button[disabled]`). The wrapper API is unchanged; hand-authored elements work with `disabled`, `disabled=""`, or the old `disabled="true"`. ARIA mirrors stay string-valued.
- **Custom-tone `primary` fill normalizes lightness.** A custom `tone` on `priority="primary"` keeps the source hue + chroma but pins lightness near the Brand primary's (via `oklch(from … L c h)`), with hover/active stepping it, so a too-light or too-dark input still lands at a Brand-like fill. Secondary/tertiary/quaternary (hue-only) are unchanged.

### Fixed
- **`<a-icon>` with a raw `size` attribute no longer collapses to 0×0 on browsers without typed `attr()`** (iOS Safari, Firefox). The `a-icon[size]` rule is guarded by `@supports`, so where typed `attr()` is unsupported the icon falls back to the 16px default. Use `<Icon size={N}>` (which sets `--icon-size` inline) for an exact custom size there.

## 0.1.1-dev.6 — May 28, 2026

### Added
- **`Title` component** (`<a-title>` styled tag + `Title` wrapper) — headings at one of six `level`s. Drives the type scale (font-size + line-height) and the vertical rhythm (logical `margin-block` per level), and surfaces `role="heading"` + `aria-level`. Mirrors `Text`'s `priority` (`primary`–`quinary`) and `tone` (`brand` / `success` / `critical` / `warning` / `info`). Children are arbitrary (icons, badges, any inline content beside the title text); there are no `leadingIcon` / `trailingIcon` props.
- `<a-title>` is CSS-only: no `customElements.define`, no shadow DOM. The browser treats it as a generic unknown element and the rules in `dist/elements/a-title.css` do the work, so consumers who import `@antadesign/anta/elements` get it for free.

### Changed
- `reset.css` now styles raw `<h1>`–`<h6>` to match `<Title level={n}>` at the default `primary` priority / no tone (same weight 584.62, letter-spacing 0, per-level font-size, line-height, and logical block margins). Reach for a real heading tag when SEO matters and you don't need `tone` / `priority`; reach for `<Title>` when you do.

## 0.1.1-dev.5 — May 25, 2026

### Breaking
- **`<Button>`'s default tone flipped from `brand` to `neutral`.** A button with no `tone=` now resolves to the neutral token set (gray fill, soft secondary alpha, neutral text on tertiary / quaternary) instead of brand purple. The default-branch selector moved from `:where(:not([tone]), [tone="brand"])` to `:where(:not([tone]), [tone="neutral"])`. Migration: add `tone="brand"` where you relied on the old default; everything else is unchanged.
- **`<Button tone="custom">` removed.** Pass any literal CSS colour as `tone` instead (`tone="#ff1493"`, `tone="oklch(0.6 0.25 30)"`, named colours, anything that parses as `<color>`). The wrapper hands the colour to the host via `--button-tone-source`; the CSS extracts the hue with `oklch(from var(--button-tone-source) … h)` and runs it through the brand-tone L/C curve, populating every priority × state slot. `style={{ '--button-fg-color': '#…' }}` overrides still win. Migration: drop the `tone="custom"` literal + the trio of `--button-{bg,fg,br}-color` declarations and set `tone` to the source colour. Relative-color `oklch(from …)` is the only modern-CSS dependency (Safari ≥16.4, Firefox ≥113, Chrome ≥119).

### Changed
- `Button`'s `tone` type widens: the `'custom'` literal is dropped and the union gains `(string & {})`, so any colour literal is type-safe while autocomplete on the six named tones stays intact. `AButtonAttributes.tone` mirrors it.
- `<Button>` defaults to `flex-shrink: 0`. As a flex item in a tight parent it used to compress and clip its icon / label (the host carries `overflow: hidden`); it now holds its natural width and overflows instead (the loud failure mode). Opt back in with `style={{ flexShrink: 1 }}`. The `a-menu > a-button` rule simplified accordingly.
- `iconButton` accepts an `IconShape` string as well as `boolean`. `<Button iconButton="check" />` equals `<Button iconButton leadingIcon="check" />`; the string form wins if both are set.
- Icon-only buttons gain a `min-width` / `min-height` pinned to the natural square (small 20px, default 24px, large 28px), so a tight flex parent can't squeeze the host below the 16px icon.
- Base `cursor: pointer` moved from the (deleted) shadow `:host` style into `a-button.css`, so anchor-mode buttons and JS-only consumers pick it up.

## 0.1.1-dev.4 — May 6, 2026

### Breaking
- **`anta_global_tokens.css` renamed to `tokens.css`** and split. Update the import: `@antadesign/anta/anta_global_tokens.css` → `@antadesign/anta/tokens.css`. The new file contains only the custom-property declarations on `:root` / `:root.dark`, plus a one-line `@layer base, anta, components, utilities;` order. Tokens stay unlayered (custom properties don't compete in the cascade).
- **New `reset.css` import** carries the typography defaults that used to sit alongside the tokens (`h1-h6 { font-weight: 600 }`, `strong`, `ul / ol / li / menu`, `a` link states) plus a small modern reset (box-sizing, margin reset, replaced-element block-display + max-width, form-control font inheritance, text-wrap defaults), all in `@layer anta`. For Anta's previous out-of-the-box look add `import '@antadesign/anta/reset.css'` alongside the tokens; consumers with their own reset can skip it.
- **All Anta CSS lives in `@layer anta`** — element rules, the reset, and the generate-icons output. Token declarations stay unlayered so they're available unconditionally. The pre-declared order (`base, anta, components, utilities`) keeps Anta's defaults above preflight resets (Tailwind's `@layer base`, etc.) while letting consumer components and utilities override single properties.

### Changed
- Progress colours realigned with the "Anta 0.2" Figma library (frame `1313:1219`); all four states (light × dark × neutral × info) updated. Every Progress colour resolves through an existing global token (`--bg-block` / `--bg-spot` / `--border-2` / `--text-2` / `--text-3` and `-info` variants).
- `--progress-indicator-edge` is declared once at the base level and derives from `--progress-border-color` via relative-colour syntax, so the right-edge gradient tracks the border colour in every state.
- `<a-progress-number>` colour moved from `--text-1` / `--text-1-info` to `--text-2` / `--text-2-info`, matching Figma's `component/progress/text-{neutral,info}`.
- `<a-progress-text>` and `<a-progress-hint>` are tone-aware: in `tone="info"` they pick up `--text-2-info` / `--text-3-info` instead of staying neutral (previously a visual bug).

### Added
- New `table-2` icon on `<a-icon>` (Lucide-derived); `synonyms.json` updated (`table`, `grid`, `data`, `spreadsheet`, `rows`, `columns`); `a-icon.shapes.{ts,css}` regenerated.
- New `sun` and `moon` icons for theme-toggle UIs.
- New `refresh-ccw-dot` icon, used by the playground reset button and any "revert to defaults" affordance.

## 0.1.1-dev.3 — May 5, 2026

### Changed
- Dark-mode text tokens `--text-{3,4,5}-{success,critical,warning}` re-anchored to their level-2 base hue (matching the light-mode pattern and the Figma "Anta 0.2" source). Dark-mode success / critical / warning text at tertiary–quinary shifts slightly toward the level-2 hue; light mode is unchanged. All `bg-*` / `border-*` tokens were audited against the same source (no drift).

### Removed
- `--text-white` token. It was declared in `anta_global_tokens.css` but referenced nowhere and isn't in the Figma source. Consumers relying on `var(--text-white)` should use `#ffffff` (or `white`) directly, or define their own.

## 0.1.1-dev.2 — May 3, 2026

### Added
- Five icons on `<a-icon>`: `swatch-book`, `hat-glasses`, `heart-handshake`, `hourglass`, `text-initial` (Lucide-derived); `synonyms.json` updated, `a-icon.shapes.{ts,css}` regenerated.
- `Icon` wrapper gains a `label` prop. Set, the wrapper exposes `role="img"` + `aria-label={label}` so the icon is announced. Omitted (default), the icon is decorative (`aria-hidden="true"`).
- `Progress` wrapper composes a single `aria-label` from `label` + percentage + `hint`, joined with ` · `, so screen readers announce what sighted users see. The element still sets `role="progressbar"`, `aria-valuenow`, `aria-valuemax`.
- `general_types.ts`: `AProgressAttributes` and `AIconAttributes` declare typed ARIA attributes so JSX type-checks the wrapper's pass-through.

### Changed
- **Convention strengthened (no API impact):** ARIA wiring (`role`, `aria-*`, `tabindex`) lives in the `src/components/<Name>.tsx` wrappers as attribute pass-through, never inside the web component class. Web components stay pure declarative DOM. Documented in `CLAUDE.md`.
- Default body `font-weight` in `anta_global_tokens.css` changed to `400` for `:root, .light` (was `390`) and `.dark` (was `350`). The old values applied a small optical offset so dark text rendered thinner; the new values are uniform. Apps overriding `font-weight` on `:root` or `.dark` are unaffected.

## 0.1.1-dev.1 — May 3, 2026

### Added
- `:root, .light` selector mirror in `anta_global_tokens.css`, so consumers can apply the `light` class to a subtree to opt back into light tokens even under a `.dark` ancestor (useful for dark/light comparison demos).

## 0.1.0-dev.1 — May 2, 2026

### Added
- `Text` component + `<a-text>` element. Props: `priority` (`primary` / `secondary` / `tertiary` / `quaternary` / `quinary`), `tone` (`brand` / `success` / `critical` / `warning` / `info`), `inline`, `truncate` (`true` for single line, integer ≥ 2 for line-clamp), `expandable` (chevron + fade-out mask, click or Enter to expand).
- `Icon` component + `<a-icon>` element. Mask-based icon set recoloured via `currentColor`; `size` sets `--icon-size`; 80+ shapes derived from Lucide / Feather / Blueprint.
- `scripts/generate-icons.mjs` — a Node generator that emits `a-icon.shapes.css` and `a-icon.shapes.ts` from a folder of SVGs. The `.ts` file augments `IconShapes` via a `declare module '@antadesign/anta'` block, so consumer-generated icons merge with Anta's `IconShape` type.
- Global element defaults in `anta_global_tokens.css`:
  - `<a>` styling — colour, a hairline (0.5px) underline at 75% alpha, `--link-color-hover` + 1px underline on hover.
  - `<ul>` / `<ol>` get `padding-left: 3ch` and `li::marker` muted to `--text-5`; `li` gets a `0.5em` bottom margin.
  - `<menu>` is reset (no list-style, padding, or margins) as a clean semantic container.
- New tokens `--link-color`, `--link-color-hover` (in `:root` and `.dark`).
- `NOTICES.md` at repo root attributing Lucide (ISC), Feather (MIT), and Blueprint (Apache 2.0); included in the published tarball.

### Changed
- Prose link styling moved out of the docs `base.css` into Anta's global tokens, so every consumer of `anta_global_tokens.css` gets the same defaults.

### Notes for upgraders
- If you inlined your own `a { color: ... }` rule, Anta's defaults now apply unless overridden (the underline / link colour / 1px hover thickness / `currentColor` decoration mirror). To opt out for one element, set `text-decoration: none` and your own `color`.
- If you styled `<menu>`, `<ul>`, or `<ol>` from scratch, expect the new defaults; override with more-specific selectors as needed.

## 0.0.x — through April 2026

Initial scaffolding: package layout, the `Progress` component (`<a-progress>` element + `Progress` wrapper), and the light/dark CSS-token system imported from the Figma "Anta 0.2" library (background / text / border tokens × 5 levels × 5 tints + neutral, with hex + oklch dual declarations). No formal versioning during this period; treat it as the seed of the design system.

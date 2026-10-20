# Changelog

This page tracks changes that ship in `@antadesign/anta`. Documentation-only
changes are not listed.

## Unreleased

### Changed

- [Steps](/steps/#priority) uses tighter marker-to-text spacing for tertiary
  priority across all themes.
- [Steps](/steps/) uses square markers, a separate selection ring,
  and the theme's control fills in Antithesis.
- [Steps](/steps/#markers-and-hints) numbers incomplete and disabled phases by
  their position. Loading, completed, and error phases retain their state
  indicators, and custom markers take precedence.

### Fixed

- [Steps](/steps/#priority) improves secondary marker contrast in Antithesis with
  lighter tints, stronger foreground colors, and a clearer hover fill. Completed
  steps also show hover feedback across all three priorities.

- [Steps](/steps/#orientation) keeps vertical tertiary connectors aligned through
  active panels in every theme.

- [Steps](/steps/#width) keeps text blocks at least `4ch` wide and scrolls narrow
  sequences without overlapping markers. Empty text blocks have no minimum.

- Input and InputTime keep single-icon actions square with Tooltip content in
  raw HTML and JSX.
- Button and ButtonCopy preserve their fallback accessible names with only
  Tooltip, copy helpers, or empty children, including fragments and conditional
  children. Explicit accessible names continue to take precedence.

### Breaking

- Input and InputTime no longer use `data-anta-icon-only` for action sizing.
  Set a custom SVG or image action's width with CSS. Wrap bare text beside an
  icon in an element to keep the action's natural width.

## 0.3.35 — October 18, 2026

### Added

- [Panel's layout placeholder](/panel/#styling) exposes `::part(placeholder)`
  for styling the reserved region while maximized.

- [Text's inert expansion mode](/text/#truncation-and-expansion):
  `expandableInert` makes the folded, overflowing preview one expand target and
  skips content interactions until expanded. Text that fits remains interactive.

- [Input button fields](/input/#styling) expose `::part(input-label)` for their
  value or placeholder. [Select](/select/#migrate-field-styles) uses the same part.

- [Select's `dimActions` prop](/select/) controls its trigger adornments. Pass
  `false` to keep them visible instead of dimming them until hover or focus.

- [Menu's header and footer slots](/menu/#styling) expose styling parts, and
  [Dialog's optional regions](/dialog/#styling) expose CSS states for assigned
  header and footer content.

- [Title typeface](/title/#typeface): `font` sets a title in `serif`, `sans-serif`,
  or `monospace` and overrides the theme's level default.

### Breaking

- [Icon](/icon/) and [Loader](/loader/) imports load styles without registering
  custom element classes. If an integration requires a defined tag, call the
  existing `register_a_icon()` or `register_a_loader()` export explicitly.

- [Calendar selection](/input-date/#calendar) leaves authored input attributes
  unchanged during uncontrolled picks, reset, and restoration. Its `.value`
  getter now returns `null` when empty; InputDate retains its empty text value
  (`''`).

- [Slider controlled values](/slider/#managing-the-value) change only when the
  application updates `value`, including on form reset. Callbacks report requested
  values; read the element's `value` for its applied result. Uncontrolled
  interaction, reset, and restoration no longer rewrite input attributes. Remove
  `value` to release control while retaining the applied number.

- [Browser support](/install/#browser-support) requires Chrome/Edge 135+ and
  Firefox 136+. Safari/iOS Safari remains 17.4+. Input labels and hints use live
  ARIA element references without a copied-text fallback.

- [Browser hydration](/install/#browser-hydration) requires
  `configure(h, Fragment, hooks, { hydratingEvents: true })` before mounting.
  Client-only apps and worker renderers forward handlers immediately by default,
  without an extra render for listener setup.

- [Custom renderer configuration](/install/#preact-without-compat) replaces the
  hooks object as a whole. Pass your runtime's hooks rather than selecting a few;
  missing hooks report an error instead of using another renderer's hooks.

- [Panel inside an application shadow root](/panel/#styling) now requires a
  stylesheet link to `@antadesign/anta/elements/a-panel.css` inside that root
  for its maximized layout. Document styles cannot reach its internal parts.

- Normal part overrides for [Dialog](/dialog/#styling), [Menu](/menu/#styling),
  [Slider](/slider/#styling), and [Panel](/panel/#styling) follow Anta's document
  cascade layers. Move overrides from `base` to `components`, `utilities`, or
  unlayered CSS.

- [Select single selection](/select/#managing-the-value) uses `null` for a
  controlled empty value, and Clear reports `null` instead of `undefined`. Use
  `V | null` for single-select state and callbacks; reset with `value={null}`.
  Omitted or `undefined` values remain uncontrolled, and multiple selection
  continues to use arrays with `[]` for an empty selection.

- [Select's default field](/select/#migrate-field-styles) uses `a-input[button]`,
  which receives `className` and `style`. Replace `a-select-field > a-button`
  selectors with `.my-select::part(field)` on your field class, and use
  `.my-select::part(input-label)` instead of `a-button-label` for selected text.
  Existing raw `a-select-field` compositions retain their CSS, JSX types, and
  label and hint behavior.

- [SelectFaceted text editors](/select-faceted/#styling) use the CSS-only
  `a-select-faceted-text` wrapper. Replace selectors such as
  `a-menu div[data-menu-open] > a-input` with
  `a-menu a-select-faceted-text > a-input`, and move selectors that depend on the
  former inline `style` attribute to the region tag.

- [InputTime slot groups](/input-time/#styling) use `a-input-time-*` tags. Update
  selectors that target their former spans; existing slot and part names remain.

- [Expander raw markup](/expander/#web-component) uses named regions instead of
  slot attributes. Put `level` on `a-expander-summary`, select built-in artwork
  with `a-expander-indicator shape="chevron"`, and place that region before the
  title or after the actions to choose its position.

- [Banner raw markup](/banner/#web-component) uses light-DOM regions instead of
  shadow slots and `::part()`. Group actions in `a-banner-actions`.

- [Progress styling](/progress/#styling) uses light-DOM selectors instead of
  `::part()`. `AProgressElement` and `register_a_progress` are removed; raw HTML
  supplies its own ARIA.

- Expandable [Text](/text/#expand-raw-html) requires
  `@antadesign/anta/elements/a-button` when importing elements individually. The
  full bundle and elements barrel include it. JSX creates the expansion control;
  raw HTML authors supply it using the linked example.

- [Card raw markup](/card/#migrate-from-shadow-parts) uses `a-card-*` regions
  instead of shadow slots and `::part()`. Link Cards use
  `a[data-anta-card-link] > a-card-layout`. `ACardElement` and `register_a_card`
  are removed.

- The [Antithesis theme](/theming/) is copyright Antithesis Operations LLC and
  now has a separate license. Noncommercial use is free; commercial use requires
  prior written permission. Earlier MIT-licensed copies keep their original terms.
  Antune and the default styles remain MIT licensed.

### Changed

- Default styles for [Input](/input/#styling), [InputTime](/input-time/#styling),
  [Menu](/menu/#styling), [Dialog](/dialog/#styling), [Tooltip](/tooltip/#styling),
  [Copy feedback](/button/#copy-feedback), [Toaster](/toaster/#styling),
  [Expander](/expander/#styling), [Slider](/slider/#styling), and
  [Panel](/panel/#styling) load from external CSS under strict CSP.

- [Input's native decorations](/input/#styling) may remain visible in some
  browsers, including number steppers in Chrome 135 and raw HTML search controls.

- [Banner](/banner/) renders its layout before registration. Dismissal leaves
  children mounted.

- [Card](/card/) renders its layout and native link directly in HTML. Generic
  anchor display rules preserve its media and content arrangement.

- [Progress](/progress/) renders its fill and loading animation without
  JavaScript. Native `<progress data-anta>` remains a standalone control.

- [Text](/text/) renders and truncates in light DOM. Expansion preserves authored
  markup, and one-way expansion hides its control instead of removing it.

- [Expander rounding](/expander/#round-and-outdent) uses a `1rem` radius when
  `round` is `true`, independent of title level and header height. Explicit
  radius values remain supported, and native `details[data-anta][round]` uses the
  same default.

- [Select's shared stylesheet](/select/#styling) is named `components/Select.css`.
  The previous `components/select.css` and `components/select-parts.css` imports
  remain supported.

- [Tabs rounding](/tabs/#styling): a custom `round` radius applies to the tabs
  and sliding indicator as well as the primary track.

- [Tabs sizing](/tabs/#size) in the Antithesis theme matches text buttons'
  horizontal padding: 10px, 12px, and 14px per side for small, medium, and large.

### Fixed

#### Banner

- [Visibility and dismissal](/banner/#controlled-vs-uncontrolled) work after an
  initially dismissed notice and after moving between documents. Nested banners
  keep their alignment and close styling independent, and empty action regions
  take no layout space.

#### Calendar

- [Default values](/input-date/#calendar) return `null` when `.defaultValue` is
  unset, so writing it back preserves the absence of a default.
- [Property inputs](/input-date/#calendar) assigned before registration take
  effect when the element upgrades, including while detached.
- [Unbounded year menus](/input-date/#calendar) center on the displayed year, including
  dates supplied through `value` and `defaultValue`.
- [Controlled selection](/input-date/#calendar) keeps form values in sync in
  React and Preact, including selecting a previous date again.

#### Copy feedback

- [Copying](/button/#copy-feedback) remains available while feedback CSS loads.
  Disconnecting clears feedback and prevents stale clipboard results from
  reopening it after reconnection.

#### Dialog

- [Accessible names](/dialog/) follow header text edits in place, including
  React and Preact updates after hydration.
- [Named triggers](/dialog/#triggers) release their listeners on removal
  and document adoption.

#### Expander

- [Expansion](/expander/) keeps content clipped until opening finishes, then
  restores overflow. Reconnection preserves applied state.

#### Input

- [Clear and trailing actions](/input/#leading-trailing-and-clear) fit Anta
  buttons to the field height while preserving padding and natural text width.
  Icon-only Button and ButtonCopy actions are square, and raw Anta buttons can
  opt in with `data-anta-icon-only`.
- [Multiline layout](/input/#multiline) applies when `rows` is set without
  `multiline`, keeping actions aligned to the first line.
- [Trailing spacing](/input/#styling) honors inherited `--input-trailing-inset`
  overrides for text and actions. Mixed content and nested buttons keep the text
  inset by default.
- [Form names](/input/#forms) reflect to the host attribute, preserving named
  form lookup and name-based selectors in React 19.
- [Focus rings](/input/#styling) follow the focused field, and typing in large
  forms no longer refreshes focus across unrelated Inputs. Focus tracking releases
  listeners when fields disconnect.
- [Clear actions](/input/#events) affect only their owning field, including
  nested Inputs.
- [Button-backed fields](/input/) and [Select](/select/) describe the value
  only when a separate label supplies the accessible name. Empty fields keep
  placeholders out of the value description.
- [WebKit multiline sizing](/input/#multiline) uses JS autosizing to avoid crashes
  in collapsed disclosures. Fallback measurements preserve page and textarea
  scroll positions.

#### InputAutocomplete

- [Value ownership](/input-autocomplete/#managing-the-value) retains the latest
  text, including `''`, when `value` is omitted or becomes `undefined`.
  Uncontrolled editing resumes from that text; form reset still restores
  `defaultValue`.
- [Field callbacks](/input-autocomplete/#events) run alongside text updates and
  popup handling. Form reset restores the supplied default text without opening
  suggestions or moving focus from another control.
- [Suggestion interaction](/input-autocomplete/#keyboard-interaction) leaves
  composition keys with the input method and keeps rows out of Tab order.
  Editing or result changes, including label and hint edits, clear stale active
  suggestions.
- [Popup interaction](/input-autocomplete/#keyboard-interaction) keeps field focus
  on padding clicks and preserves keyboard selection when a nested control's
  disabled state changes. Results stay dismissed after focus leaves.

#### InputDate

- [Calendar triggers](/input-date/) ignore label and hint clicks. The underlying
  [Menu field anchors](/menu/) respond only to clicks within their field part.

#### InputTime

- [Touch editing](/input-time/#the-field) waits for a completed tap before
  focusing field padding. Canceled gestures no longer affect later segment
  selection.
- [Editing and clearing](/input-time/) retain incomplete edits on reconnection,
  preserve a custom tone with neutral status, and use live label and hint
  references. Read-only fields prevent edits, and `onClearClick` can cancel clear
  actions.
- [Blur commits](/input-time/#web-component) finish when a field is removed.
  Read-only focus visits emit `change` only for a pending edit, and disabling a
  parent fieldset clears keyboard focus state.
- [AM/PM labels](/input-time/) reserve space for the locale's longest label
  without native autosizing, so switching periods keeps the field width.

#### Menu

- [Custom selection indicators](/select/#custom-indicators) use external layout
  styles, preserving alignment and row activation under a strict CSP.

- [Trigger replacement](/menu/) preserves keyboard interaction, popup
  relationships, and open state, including [Select custom triggers](/select/#custom-trigger).
  Anchored popovers reposition to follow their replacement.
- [Positioning and dismissal](/menu/) keep RTL menus within the viewport and
  open stacks independent between documents. Closing or removing a menu clears
  pending navigation and positioning work.
- [Custom rounding](/menu/#styling) applies to the container in every theme.
- [Combobox cursor events](/menu/) report a cleared autocomplete cursor once,
  including when an edit also updates the suggestion rows.

#### Panel

- [Maximization](/panel/#styling) restores normal layout and focus handling
  if native popover opening fails or is canceled.
- [React hydration](/panel/#controlled) retains state-change callbacks.

#### Progress

- [Loading stripes](/progress/) match their travel distance to the bar's width
  during playback and resizing. Their blurred edges stay outside the track,
  preventing jumps and edge flicker when the animation repeats.

#### Select

- [Field layout and validation](/select/#styling) preserve leading content and
  the chevron's status color in server-rendered HTML under `style-src-attr 'none'`.

#### SelectFaceted

- [Text-editor padding](/select-faceted/#styling) survives server rendering under
  `style-src-attr 'none'`.
- [Searches and text drafts](/select-faceted/) keep working when React defers
  state updates.

#### Slider

- [Dragging](/slider/#relative-dragging) honors consumer cancellation and ends
  when disabled or disconnected. Parent updates remain applied during a drag,
  and rebasing preserves the final commit. Ancestor propagation boundaries no
  longer disable pointer or keyboard input.
- [Accessible names](/slider/#range-values) follow live label text, and scalar
  disabled state is exposed to accessibility tools.
- [Inherited RTL](/slider/#relative-dragging), including CSS `direction`, aligns
  pointer movement, thumbs, value bubbles, and markers with the rail.
- [Numeric bounds](/slider/#managing-the-value) contain small decimal values.
- [Property inputs](/slider/#managing-the-value) assigned before registration
  take effect when the element upgrades, including while detached. A runtime
  `value={null}` uses uncontrolled defaults and the matching scalar or range
  presentation.
- [Restored ranges](/slider/#range-values) keep each thumb on its restored
  endpoint when the application takes control.

#### RadioGroup and Tabs

- [RadioGroup](/radio/) and [Tabs](/tabs/) retain the latest applied selection
  when the JSX `value` prop is omitted or the raw `state` attribute is removed.
  The keyboard tab stop and active tab panel follow the retained selection.
- [Per-option tones](/tabs/#tone) color the selected indicator without recoloring
  the track. An explicit neutral option resets the indicator on a toned strip.

#### Steps

- [Vertical panels](/steps/#orientation) follow the selected step using external
  CSS, including when a Content Security Policy blocks inline style attributes.

#### Text

- [Keyboard order](/text/#truncation-and-expansion) places expansion controls
  before content links. Raw HTML authors place the control before `a-text-content`.
- [Folded content](/text/#truncation-and-expansion) stays in place when a clipped
  link receives focus and remains selectable.
- [Mixed imports](/text/#truncation-and-expansion) preserve expansion controls'
  accessible names and expanded state when granular entries load before the bundle.
- [Control layout](/text/#truncation-and-expansion) spans the full width for
  multiline text and the inline end for single-line text. Collapse controls leave
  revealed links clickable without adding padding to folded text or changing its
  width on expansion.

#### Toaster

- [Countdown progress](/toaster/) survives interrupted exits and reconnection.
  Reattaching an already-dismissed toast emits completion for its new owner.
- [DOM-node content](/toaster/#web-component) clears to `null` when its prop is
  removed. Refilled fragments can be assigned again to replace their previous
  children.

#### Tooltip

- [Interactive content](/tooltip/) stays open during keyboard travel, and
  reduced motion disables fades.

## 0.3.34 — October 5, 2026

### Added

- [Title](/title/) and [Tag](/tag/) have granular `elements/a-title` and
  `elements/a-tag` entries that load their CSS without registering custom elements.

### Changed

- [Reference themes](/theming/#fonts-in-a-theme) no longer load hosted fonts or
  replace the system font stacks. Load your chosen fonts in an application-owned
  stylesheet; font-specific features and variation axes are also application-owned.
- JSX wrapper imports no longer load CSS. For granular usage, load composed
  layout styles in the UI thread through `elements/a-breadcrumbs`,
  `elements/a-steps`, `elements/a-input-date`, `elements/a-select`, or
  `elements/a-select-faceted`, alongside their nested browser elements.
  Full bundle usage is unchanged.
- The Antithesis theme adds an interactive color layer: `--fill-*`, `--stroke-*`
  and `--label-*`, named by step, tone and state. [Buttons](/button/),
  [Checkboxes](/checkbox/), [Radios](/radio/) and [Inputs](/input/) read their
  colors from it. It replaces the theme's `--fill-{tone}` and `--control-*`
  variables. Inputs in this theme draw a 1px border and a 2px focus ring inside
  the field.
- Selected paddingless [Buttons](/button/#paddingless) draw their 1px selection
  ring outside the label. Their corner radius is capped at 3px, including when
  `round` requests a larger radius.

### Fixed

- [Avatar](/avatar/) images and generated pictures keep their size, rounding,
  and badge layout under `style-src 'self'` without allowing inline styles.
- Individual element stylesheets resolve through `@antadesign/anta/elements/*.css`,
  including imports with a bundler's `?raw` query.
- [Tab panels](/tabs/#panels) follow their own strip when multiple `Tabs` share a
  parent, including when another `Tabs` appears before an outer panel.

## 0.3.33 — September 28, 2026

### Added

- [Input priority](/input/#priority) adds secondary fields without a fill and
  tertiary fields that reveal their border on hover or focus.
- [Slider](/slider/) accepts a two-value range with crossing thumbs and an
  `inverted` track fill. Range values use two space-separated numbers in the
  web component attribute and a sorted number pair in JavaScript and callbacks.

### Fixed

- [Button](/button/) ignores non-form `form` references instead of throwing
  during submit or reset activation.
- [Slider](/slider/) keeps both thumbs and tuple callbacks after a form reset
  when a range has no `defaultValue`.
- Clearable [Input](/input/), [InputDate](/input-date/), and
  [InputTime](/input-time/) fields reserve the clear button's space while empty,
  so showing it does not add width.
- [Menus](/menu/) opened inside `data-menu-open` content now close after a choice
  without closing the surrounding menu.
- Clearing an [InputDate](/input-date/) field no longer toggles its calendar.
- Switching [Menu](/menu/) submenus closes nested controlled popups cleanly, so
  an [InputDate](/input-date/) calendar can reopen after its facet is revisited.

## 0.3.32 — September 25, 2026

### Added

- [Expander indicators](/expander/#actions-and-indicators) can sit after header actions and
  use built-in chevron, triangle, or plus visuals. Custom indicators can rotate
  as one node or switch between closed and open nodes.
- [Box measurements](/box/#measurements) can include
  descendant rects with `includeRectsFor`, including positions relative to the
  Box, width, and height. Changed rects appear in `detail.changed.rects` when
  another observed field triggers a report.
- [Box measurements](/box/#measurements) can stay active outside the viewport
  with `observeOffscreen` when a virtualized layout needs updates there.

### Changed

- [Box layout](/box/#display) now uses `position: relative` by default, so
  absolutely positioned descendants use the Box as their containing block. Set
  `position: static` on the Box if they should use another positioned ancestor.
- [Box measurements](/box/#measurements) now apply `throttle` to measurement
  reads and CSS states as well as events. The edge mask eases between states;
  larger intervals delay the fade response during scrolling.

### Fixed

- [Expander indicators](/expander/#actions-and-indicators) leave the mark empty for
  unrecognized strings and numbers instead of displaying them as text.
- [Menu submenus](/menu/#submenus) stay open when a nested
  date picker closes under the pointer outside the submenu. Hover dismissal
  resumes after the pointer returns. Closing a nested popup away from the
  pointer leaves hover dismissal available.
- [Dialog headers](/dialog/#zones) wrap long unbroken text
  and clip content that still overflows their bounds.

## 0.3.31 — September 18, 2026

### Added

- MenuItem supports a trailing switch selection indicator for immediate
  settings. Switch rows keep their menu open when selected.
- Title supports single-line and multi-line truncation with an automatic
  full-text tooltip when the heading is clipped.

### Fixed

- Button loading stripes loop seamlessly while their rounded clipping stays
  local to the animated overlay.
- Copy confirmation labels stay visible when a control is near the top edge of
  the viewport.
- Keyboard navigation leaves modified arrows, Home/End, and PageUp/PageDown
  available to browser, system, and text-editing shortcuts. Menus also preserve
  modified Tab shortcuts. Shift+Tab traversal and Calendar's Shift+PageUp/PageDown
  year navigation remain available.
- Antune preserves Tabs tone colors in the primary track and secondary selected
  fill, including selected per-tab tones.
- Panel uses `overflow: auto` in normal and maximized states, so scrollbars
  appear only when content overflows.

## 0.3.30 — September 17, 2026

### Added

- Added Plot as the separate `@antadesign/plot` package for interactive canvas
  charts in React, Preact, and plain JavaScript.
- Export `useRef` and `useLayoutEffect` from the JSX runtime, with React defaults
  and overrides through `configure()` for other renderers.

### Changed

- Updated and pinned runtime dependencies to exact versions.

## 0.3.29 — September 15, 2026

### Added

- SelectFaceted single and multiple facets support `renderOption` for custom
  option content in facet flyouts and global search results. Render custom
  option data as key–value Tags while retaining selection handling and indicators.
- Box supports `padding` and `margin` props and HTML attributes. JSX numbers
  use pixels; strings accept CSS shorthand values.
- Panel is a persistent container that can maximize to the browser viewport
  through a manual popover while keeping its DOM children mounted. Maximized
  panels contain keyboard focus until restored. Panels fill their parent's
  width and height and use `overflow: scroll` by default. The maximized surface
  inherits the Panel's background.

### Changed

- Switch defaults to neutral in both states. Pass `tone="brand"` for brand coloring,
  and add `toneScope="selected"` to tint only the checked track.

- Select uses Anta Button for its default trigger, preserving popup accessibility,
  keyboard-only focus rings, and ellipsis for long values. Its accessible description
  includes the current selection and field hint. Menu button triggers
  open with ArrowUp and ArrowDown. Select field styling now targets its
  `a-select-field` wrapper and child `a-button` instead of Input shadow parts.

- Calendar adjacent-month dates are hidden from assistive technology and reach
  full opacity on hover or focus when enabled.
- The default Alt/Option-click hint in multi-select option menus appears to the
  left of its row after 700ms, and moving between rows restarts that delay.
- Tooltip delay-free handoff now applies only when both the outgoing and incoming
  tooltips have `follow`. Tooltip supports centered-left placement with
  `placement="left"` and flips right when space is limited.
- Input and its composed controls now expose roles, labels, popup relationships,
  required state, and active options on the controls that receive focus. Direct
  ARIA element references avoid generated Calendar, popup, and option ID
  collisions across application roots.
- Checkbox, Switch, and Radio hints are accessible descriptions. Tabs use a
  roving tab stop, and `TabPanel` forwards common component props.
- Every independently loadable stylesheet now reserves Anta's public and
  internal cascade-layer order. Granular element imports therefore keep
  component and theme rules above `reset.css` even when a bundler loads their
  CSS before `tokens.css`.
- Breadcrumbs no longer scroll horizontally by default, so button focus rings
  remain visible. To enable scrolling, set `overflow-x: auto` on the trail and
  `outline-offset: -1px` on its focused controls.
- **Breaking:** Box measurement events now trigger on border-box width and
  height changes by default. `observe` accepts `width`, `height`, `size`,
  `context`, `overflow`, `edges`, `scroll`, or `all`, individually or in a typed
  array. Plain HTML accepts the same selections separated by spaces.
  Use `overflow` for content-driven CSS states or `edges` for scroll-edge
  changes; size observation skips content and scroll observers. `throttle` sets
  the event interval in milliseconds without delaying CSS fades or on-demand
  truncation checks.
- Tags no longer impose `max-width: 100%`. Labels and values still ellipsize
  when the application constrains the tag’s width.

### Fixed

- Menu Tab navigation follows rendered slot order and reaches controls inside
  shadow DOM, including individual InputTime segments.
- Dialog menus preserve menu semantics for body items when no search field is present.
- Panel preserves maximize and restore focus handling when custom element states
  are unavailable.

- Neutral `text-4` meets at least 4.5:1 contrast against `bg-1` in both light
  and dark modes for Antune and None. This guarantee does not extend to named
  tones or other backgrounds.
- Clicking inside a parent menu closes nested menus outside the clicked branch.
  Calendar's month/year picker closes when clicking elsewhere in the calendar,
  including the month navigation arrows.
- Nested menus reset when their controlled parent closes. InputDate's month/year
  picker can reopen after selecting a date while the picker is open.
- Calendar weekday headers use a higher-contrast text color, including weekends.
- Slider exposes its `ElementInternals` through the same runtime inspection hook
  as other stateful controls, allowing accessibility tooling to inspect its live
  range semantics.

## 0.3.28 — September 10, 2026

### Changed

- **Breaking:** Checkbox, RadioGroup, Switch, MenuItem, Select, and SelectFaceted
  now use one `tone` identity plus `toneScope="all" | "selected"`. The
  `toneSelected` prop and `tone-selected` custom-element attribute were removed;
  use `tone="…" toneScope="selected"` (or `tone="…" tone-scope="selected"` in
  HTML) for neutral resting chrome with a toned selected state. Select and
  SelectFaceted now accept `tone` as their default option-row tone. Switch's
  default brand tone now covers its unchecked chrome too; set
  `toneScope="selected"` to retain the previous neutral unchecked appearance.
- Renamed the optional Anta theme to Antune. Replace imports of
  `@antadesign/anta/theme-anta.css` with `@antadesign/anta/theme-antune.css`.
- Reference themes provide hosted font faces by default through the public
  `--sans-serif`, `--serif`, and `--monospace` stacks. Applications can replace
  the stacks directly in CSS loaded after the theme.
- Theme-free components no longer force TT Interphases stylistic sets or
  variable-font axes. Antune and Antithesis own those font-specific treatments,
  while numeric surfaces retain portable tabular figures.
- Theme-free Buttons use `0.025ch` tracking and Tags use `0.1ch`. Antune and
  Antithesis use `0.05ch` Button tracking across priorities and retain their
  font-specific Tag tracking.
- JSX wrappers omit `tone="neutral"` where neutral is the standalone default;
  explicit child resets remain in the rendered DOM when they override an
  inherited group tone.
- Reference-theme font stacks and role tokens use normal selectors, so the
  documented tokens, theme, application CSS source order controls overrides.
- Reference themes register separate upright and italic TT Interphases faces,
  mapping semantic italics to the font's `slnt` axis without a ranged face that
  Safari can apply to ordinary text.
- Paired component colors follow the nearest inherited `color-scheme`, so nested
  `.light` and `.dark` regions do not inherit an outer mode's component colors.

### Added

- Added `theme-antithesis.css`.

### Fixed

- Antune and Antithesis pin regular TT Interphases text and `dfn` to `slnt` 0,
  including form controls that reset font shorthand inheritance. This keeps
  text upright in Safari despite the font file's non-zero axis default while
  preserving the `slnt` 11 instance for semantic italics.
- `tokens.css` declares `color-scheme` on `:root`, `.light`, and `.dark`, so
  component colors resolve to the right mode without the optional `reset.css`
  import.
- A per-tab `tone` on the selected Tab tones the strip's secondary tab
  background, so non-toned sibling tabs pick up the same tint.
- `--avatar-badge-chroma` applies to `badge="neutral"` again.
- Small Input, Select, InputTime, and opt-in native controls keep their declared
  font size while focused on touch devices instead of growing to 16px.
- Antune restores the dark neutral Radio border used by the original palette.
- Package documentation can be regenerated by explicit output path without
  rewriting the complete generated documentation tree.
- `b` uses the same `600` font weight as `strong` in the typography reset.

## 0.3.27 — September 6, 2026

### Added

- Added `Capture` / `<a-capture>`, a new input container for custom wheel,
  pointer, and pan gestures. Each capability is opt-in and emits serialized
  input with coordinates relative to the component.

### Fixed

- Packaged Markdown includes comparison tables, color and system-color references,
  icon and sticker catalogs, and theming-lab inputs.
- `Slider` stops dragging after lost pointer capture or a missed button release,
  so moving back over it without pressing cannot move the thumb.
- `Checkbox` sets its ARIA state and form value in Safari 16.4-17.3 and Firefox
  93-125, where `ElementInternals` lacks `CustomStateSet`.
- `Box` removes its per-window store only when that store is the one still
  registered, so a page that mounts and unmounts boxes repeatedly keeps one
  document-wide class observer instead of accumulating them.
- `Box` ships its TSDoc in `dist/components/Box.d.ts`, so editors show the
  description and example on hover.

## 0.3.26 — September 4, 2026

### Added

- Added `Box` / `<a-box>`, a light-DOM container with layout props, overflow
  states, optional edge fades, and measurement and context events. Set
  `observe` to update states or receive events; the JSX wrapper derives it from
  handlers, while a hand-written `<a-box>` sets it directly.

### Fixed

- `Box` applies its fade mask only to edges that hide content, preserving an
  outset box shadow and focus ring when all content is visible.
- `Tooltip` with `truncatedOnly` detects clipping on its own `Box` anchor when
  child labels do not truncate.
- Raw custom-element length and color attributes work in Firefox and Safari,
  which do not support typed `attr()`.
- Custom states work in Safari 16.4-17.3 and Firefox 93-125, where
  `ElementInternals` lacks `CustomStateSet`.

## 0.3.25 — September 2, 2026

### Added

- `<textarea data-anta>` uses Input field styling and supports `data-anta-size`,
  `round`, and `tone`.

### Changed

- `Banner` content starts at the inline edge by default; pass `align="center"` to
  center it.
- `reset.css` now applies Anta page and prose defaults; `body` backgrounds paint
  the browser canvas. For page-wide dark mode, put `class="dark"` on `<html>`;
  use `class="light"` in a dark subtree.

### Fixed

- Native `data-anta` checkboxes and radios match component colors with
  `theme-anta.css`.
- `MenuItem` maps `kbd` hints to `aria-keyshortcuts`; spaces separate shortcuts.

## 0.3.24 — August 25, 2026

### Added

- Added `Breadcrumbs`, which composes links, actions, and copy controls with
  text or icon separators and deterministic More-menu folding.
- `MenuItemCopy` supports leading, trailing, or no copy glyph, matching
  `ButtonCopy` placement and confirmation options.
- Buttons accept `underlineOnHover` with a configured underline style.
- `Input` and `InputTime` accept `autoFocus` for focusing the field when its
  containing `Dialog` opens.
- Added the `circle-user` icon shape.

### Fixed

- Focused editable Anta and `data-anta` fields use at least 16px type on touch
  devices, preventing iOS automatic input zoom.

### Removed

- Removed the `text-highlight` icon shape.

## 0.3.23 — August 23, 2026

### Removed

- Removed the `education-disk`, `help-disk`, and all `*-logo` icon shapes.

### Added

- `@antadesign/anta/bundle` and `bundle.css` provide one minified full-runtime
  entry and one matching stylesheet for applications that prefer full imports.
- `Steps` provides controlled and uncontrolled process navigation with optional
  panels, horizontal and vertical layouts, accessible tab semantics, process
  states, number and icon-shape markers, state-aware `renderMarker`, labels
  and hints with clipped-content tooltips, and per-option tones.
- `Loader` accepts a named `tone`; the loading Steps state forwards the
  option tone to it.
- `Tabs` and `Steps` accept `fill`. Tabs share the available width equally;
  Steps stretch their connectors between content-sized phases.
- `Steps` adds `primary`, `secondary`, and `tertiary` priorities. Primary uses a
  solid selected marker and stronger completed connectors; tertiary is compact
  and borderless.
- `StepOption` defaults to the neutral tone. Omitting its `tone` or passing an
  empty string produces the same result; selected rings use the stronger
  `border-1` step.

- `Avatar` renders an image, seed-generated placeholder, or initials, with
  `generator`, `badge`, and `round` options. `avatar-core` generation helpers are
  also exported.

### Changed

- `Avatar` default generation uses a larger head-to-body gap, shifts figures
  slightly upward, and varies their position, rotation, color, scale, and shape
  more widely.
- `Slider` thumbs are smaller: 12px at `small`, 16px at `medium` (the default,
  previously 18px), and 20px at `large`, unchanged. `thumbSize` still overrides
  any of them.

## 0.3.22 — August 20, 2026

### Changed

- JSX `Input` now truncates overflowing single-line values by default. Pass
  `truncate={false}` to show the full value.
- Selecting a `Menu` item no longer bubbles the click to ancestor handlers (e.g. a
  clickable row the menu sits in). Set `stopPropagation` to contain more event types.
- Open menus follow their trigger vertically as it scrolls or shifts, keeping the
  side chosen at open.

### Fixed

- Buttons and Tags with an explicit `tone="neutral"` now receive the reference
  theme's neutral values.
- Disabled and loading Buttons with `href` now use the disabled palette and block
  activation.
- `Select` and `InputDate` triggers carry a `combobox` role, so their
  `aria-expanded` is valid (WCAG 4.1.2 / `aria-allowed-attr`) — it was previously
  set on an element with no supporting role.
- Checkbox, Radio, and Switch now show one focus ring around their visual control.
- Checkboxes without a tone now receive the Anta neutral reference values;
  `tone="neutral"` remains equivalent.
- Checkbox and Radio `toneSelected` now consistently overrides `tone`, including
  explicit neutral selected tones and custom `RadioGroup` tones.
- `a-input` and `a-input-time` now treat `status="neutral"` like their default
  status.

## 0.3.21 — August 11, 2026

### Added

- `Select`, `SelectFaceted`, `InputAutocomplete`, `RadioGroup`, and `Tabs`
  option objects accept `className`, `style`, and safe `data-*`
  attributes on their rendered rows. `data-menu-*` remains component-owned.

### Fixed

- Tab panels no longer add a default tab stop.
- Menus no longer dismiss when their visible trigger changes size. They request
  dismissal only after the trigger leaves the viewport.
- JSX `Text` now shows its clipped content in a tooltip by default. A nested
  `Tooltip` replaces it, and expandable text does not add one.
- The Anta theme now uses the shared focus-ring colors in light and dark modes.

## 0.3.20 — August 4, 2026

### Changed

- Package documentation and source comments use clearer, more concise language.

### Fixed

- Expander titles can be selected without toggling the disclosure.

## 0.3.19 — August 3, 2026

### Added

- The package now ships version-specific Markdown documentation under `docs/`.
  Its README directs coding agents to the installed documentation index.

### Changed

- Native `data-anta` select popups now follow Menu styling for their surface,
  option sizing, colors, and 1px item spacing when customizable selects are
  supported.

### Fixed

- Sliding Tab indicators no longer animate through stale geometry while their
  strip is resized.
- Slider focus rings now surround only the range control, rather than the
  complete Slider host.

## 0.3.18 — August 1, 2026

### Changed

- The Anta theme's `--focus-ring` now follows its brand text color.
- `reset.css` gives plain keyboard-focused HTML the 1px Anta focus ring.

### Added

- `Loader` provides animated icon-sized feedback, determinate circular progress,
  a `speed` prop, and the `loader` icon-shape alias for string-only icon props.
- `Progress` shows an indeterminate loading animation when `value` is omitted
  or set to `false`.
- `Progress` supports `small`, `medium`, and `large` sizes.
- Native HTML `<progress>` elements opt into the Progress appearance with
  `data-anta`.

### Fixed

- Custom `Progress` tones now use the same track, fill, and edge progression as
  named tones in light and dark themes.

## 0.3.17 — July 31, 2026

### Added

- `Slider`, a single-value form control with relative rail dragging, configurable
  value placement, text markers, sizes, tones, shared corner radii, CSS parts for
  thumb and track styling, and an opt-in `data-anta` treatment for native ranges.

### Breaking

- Anta now requires Chrome or Edge 125, Safari 17.4, or Firefox 126 for
  custom-element states and the `:state()` selector.

### Changed

- `InputTime` segments now use native text inputs. They retain native caret,
  selection, paste, and IME behavior while keeping Anta's locale-aware layout
  and cross-segment navigation.
- No-icon `ButtonCopy` leaves its button unchanged and shows a cursor-near
  success label. Set `copiedLabel` to change the label text.

## 0.3.16 — July 29, 2026

### Added

- `Switch`, a binary control with `tone`, `toneSelected`, `hint`, and `round`.
- The `dollar-sign` icon.
- Native HTML form controls opt into Anta chrome with `data-anta`, including
  text-like and date/time inputs, file pickers, submit/reset buttons, checkboxes,
  radios, details disclosures, and customizable selects.
- Native `data-anta` controls accept matching visual variants, including choice
  control sizes and tones, field sizing and rounding, and Expander surfaces and
  levels.

### Changed

- In forced-colors mode, Anta controls and surfaces use system colors and
  visible borders for their interactive, selected, and disabled states,
  including icons, inputs, buttons, tags, choice controls, tabs, Expanders,
  Cards, Dialogs, Banners, Progress, and Tooltips.
- Switch tracks use a real 1.5px border instead of an inset shadow.

### Fixed

- No-icon `ButtonCopy` feedback now keeps a wrapping label's width and line breaks.
- Native HTML radio labels use Anta's 8px control gap and vertically centered
  alignment.
- `InputAutocomplete` now commits the highlighted suggestion when users press
  Arrow keys then Enter.
- `a-input` forwards its native `input` event across the shadow boundary in
  browsers that do not compose it automatically.
- Direct controls in an Expander's `actions` slot retain their Anta styling.
- A Banner's built-in dismiss button now follows the Banner's `round` setting.

## 0.3.15 — July 28, 2026

### Added

- `Toaster` and `Toast` for managed notifications. Add a `Toaster`, then use its
  manager to add, update, dismiss, or clear toast content.

### Changed

- Static trailing input adornments are inset. Trailing buttons remain flush with
  the field edge.

## 0.3.14 — July 28, 2026

### Added

- `Select` supports verbose multi-value summaries and `renderSummary`.
- `Banner`, a dismissible status strip with optional actions and tones.
- `StateChangeEvent` from `@antadesign/anta/anta_helpers`.

### Changed

- `Select` shows `All` when every enabled option is selected. `SelectFaceted`
  summaries now truncate instead of widening their trigger.

### Fixed

- Text inputs inside menu items accept spaces. Text facets preserve typed spaces.

## 0.3.13 — July 25, 2026

### Added

- Seed tokens for the neutral, brand, info, success, warning, and critical
  color scales.
- `theme-anta.css`, an opt-in stylesheet that restores the former palette.
- Default styling for raw `dfn` elements.

### Changed

- The default palette now derives from the six seed tokens. Import
  `theme-anta.css` to keep the former palette.
- Tooltips wait 300ms by default and option tooltips follow the pointer.
- Expanders scroll wide body content instead of overflowing their container.

### Breaking

- `Text` and `Title` no longer support `priority="quinary"`. Use
  `quaternary` or style the raw element with `--text-5`.

### Fixed

- Validation status takes precedence over an input's custom `tone`.
- Tabs no longer move the page when their selection changes.
- Tabs and radio groups initialise correctly after a client-side HTML swap.
- `Button` accepts `href={undefined}` without a type error.

## 0.3.12 — July 23, 2026

### Breaking

- Copy behavior moved from `Button` and `MenuItem` to `a-copy`. Replace
  `<Button copy={value}>` with `<ButtonCopy copy={value}>`, or compose
  `<a-copy>` inside a control.

### Added

- `Select` and `SelectFaceted` accept string, number, and boolean option values.
- Menu placement and offset controls for `Menu`, `Select`, `SelectFaceted`, and
  `InputDate`.
- The standalone `a-copy` element and `ButtonCopy.iconPlacement`.

### Fixed

- Nested popups work inside menu flyouts. Tooltips outside an open menu stay
  hidden.
- Expander titles preserve the typography of custom title nodes.

## 0.3.11 — July 21, 2026

### Breaking

- `copyLazy` is removed. Pass a controlled string to `copy` and update it in
  `onCopyRequest` before activation.
- Link-mode `Button` and `MenuItem` types reject copy props.

### Added

- `copyUrl` and `copyWithUrl` for copy controls.
- `placement` and `offset` for `Select` and `SelectFaceted`.

### Changed

- Keyboard activation occurs on key release, matching native buttons.

### Fixed

- Context menus do not open through a modal or popover.
- Interactive controls inside an Expander title no longer toggle the Expander.

## 0.3.10 — July 20, 2026

### Added

- `ButtonCopy` and `MenuItemCopy` for copying strings or DOM content.

### Changed

- `Title` no longer adds margins. Add spacing on its container or use a raw
  heading for document prose.
- `Text` and `Title` use `--sans-serif` directly.

## 0.3.9 — July 17, 2026

### Added

- The `settings` icon.
- Link-mode `MenuItem` through `href`.
- Anta styling for native `<button data-anta>` elements.

### Fixed

- Buttons keep their height in constrained flex layouts.

## 0.3.8 — July 16, 2026

### Added

- `Card`, a toned content surface with media, header, body, footer, and link
  support.

### Changed

- `Text` and `Title` accept custom CSS colors as `tone` values.

### Fixed

- Stateful controls no longer close a controlled Dialog.
- `round={0}` applies square corners across components.
- Empty `tone` values on Text, Title, and Tag resolve to neutral styling.

## 0.3.7 — July 15, 2026

### Changed

- Read-only inputs show their focus ring only after keyboard focus.

### Fixed

- Menus open from keyboard interactions without synthesizing a click.

## 0.3.6 — July 13, 2026

### Added

- `Dialog`, including modal, drawer, and fullscreen positions.
- `InputAutocomplete`, a free-text ARIA combobox with suggestions.
- Optional `role` overrides for Menu, MenuItem, and Input.

### Changed

- Multiple Select and SelectFaceted controls show Select all by default. Pass
  `selectAll={false}` to remove it.
- `SelectFaceted` supports `toneSelected` and Alt/Option-click to isolate a
  multiple-choice facet.

### Fixed

- Tooltips close when their content is removed.

## 0.3.5 — July 13, 2026

### Added

- `SelectFaceted`, a controlled or uncontrolled faceted filter.
- `InputTime`, a form-associated segmented time input.
- `Menu.autoWidth` and `TabOption.tooltip`.

### Changed

- `InputDate` uses `InputTime` for time editing and follows controlled values in
  its calendar view.
- Tabs share Button's size scale and use a lighter track treatment.

### Fixed

- Closing a menu closes nested controlled menus.
- Typing a date previews its calendar date; Enter commits and closes it.

## 0.3.4 — July 10, 2026

### Added

- `optionsWithSelection` for projecting Select options onto a value set.
- `SelectOption.tooltip`, `TabOption.children`, and `Calendar.focusSignal`.

### Breaking

- Tabs are options-only. Replace `<Tab>` children with `options` entries.
  `TabPanel` children remain supported.

### Changed

- Multiple Select supports Alt/Option-click to select only one option.
- InputDate opens from the field instead of a trailing button.

### Fixed

- Input content and layout render before the custom element upgrades.
- Keyboard focus remains inside an open submenu.

## 0.3.3 — July 8, 2026

### Added

- `InputDate`, `Calendar`, and `Select`.
- Searchable Menu combobox behavior, selectable MenuItem rows, and Menu header
  and footer slots.
- `round` across core components, `Tabs.options`, `toneSelected` for selection
  controls, `Input type="search"`, and more icon shapes.

### Breaking

- Tag text keeps its original case. Replace `nocaps` with `allcaps` where
  uppercase styling is required.
- `toneText` is removed from Checkbox and RadioGroup. Style label text with CSS.
- Hand-authored anchor buttons need `data-anta` to receive Anta styling.

### Changed

- Read-only inputs truncate long values and use a pointer cursor.
- Root menus are at least as wide as their trigger.

### Fixed

- Menus, Select, and Inputs retain keyboard and focus behavior in iframes,
  flyouts, and grouped rows.
- Empty tooltips do not open. Buttons keep their configured size with non-text
  content.

## 0.3.2 — July 2, 2026

### Added

- `Tabs` and `Tooltip.truncatedOnly`.

### Breaking

- Checkbox and RadioGroup no longer support `priority`.
- `onAnyChange` is renamed to `onValueChange` on Input, Checkbox, and
  RadioGroup.

### Changed

- Checkbox and RadioGroup `tone` styles their mark. `toneText` controls label
  color.
- Components use tabular figures by default. Button exposes `role="button"`.

### Fixed

- Empty tooltips do not show. Expander headers use the Anta focus ring.

## 0.3.1 — June 26, 2026

### Added

- `MenuItem.value` and the `share` icon.

### Breaking

- Hover-opened submenus are now the default. Replace `hover` with `nohover` for
  click-only submenus.

### Fixed

- Menus stay open on activation and close only after their anchor leaves view.
- Touch interactions do not immediately close hover-enabled submenus.

## 0.3.0 — June 25, 2026

### Added

- `Checkbox` and `RadioGroup`, including form participation, controlled state,
  labels, hints, tones, and sizes.
- `Text.collapsible`, named Progress tones, custom input tones, and new icons.

### Changed

- Focus rings use the global `--focus-ring` token.
- Menu exposes `::part(menu)`. Progress exposes `::part(indicator)`.

### Fixed

- Expanders render closed before upgrade. Loading buttons cannot activate.
- Form controls, menus, tooltips, and text handle their controlled and keyboard
  edge cases consistently.

## 0.2.3 — June 18, 2026

### Added

- `Expander`, `Input`, and `Menu` with their associated item and grouping
  primitives.
- Tag priorities, a shared `--focus-ring` token, and input status support.

### Changed

- Button typography scales with `size`. Tag tones use translucent fills.

## 0.2.2 — June 13, 2026

### Breaking

- Rename `list-detail-view` to `list-collapse`.
- Tooltips are pinned by default. Remove `static`; pass `follow` to position a
  tooltip next to the pointer.

### Added

- `--tooltip-padding` and `Tooltip::part(bubble)`.

### Changed

- Buttons, Text, and Title pin Anta's font features.

## 0.2.1 — June 10, 2026

### Changed

- Table borders use `--border-4`. Monospace text no longer inherits letter
  spacing.

### Packaging

- Published CSS is minified.

## 0.2.0 — June 9, 2026

### Added

- `Tag` and the `tag` icon.

### Breaking

- Stickers moved to `@antadesign/stickers`. Install that package and update
  imports from `@antadesign/anta/stickers`.
- Text defaults to `priority="secondary"`. Pass `priority="primary"` to keep
  the former default.

### Fixed

- Empty Button tone values render as neutral.

## 0.1.1-dev.8 — June 5, 2026

### Added

- `Tooltip` and granular per-element registration.

### Fixed

- Anchor buttons keep button styling instead of inheriting link styling.
- Hover styling no longer persists after a touch interaction.

## 0.1.1-dev.7 — June 3, 2026

### Added

- `Button` and the `rotate-ccw` icon.

### Breaking

- Background tokens use the numeric `--bg-1` through `--bg-5` scale. Rename
  former background token references.
- `iconButton` is removed and `leadingIcon` is renamed to `icon`.

### Changed

- Button sizes are 24px, 28px, and 32px. The dark palette was retuned.

## 0.1.1-dev.6 — May 28, 2026

### Added

- `Title`, a CSS-only heading component with levels, priorities, and tones.

### Changed

- Raw `h1` through `h6` use the same type scale as Title.

## 0.1.1-dev.5 — May 25, 2026

### Breaking

- Button defaults to `tone="neutral"`. Pass `tone="brand"` to preserve the
  former default.
- `tone="custom"` is removed. Pass a CSS color directly to `tone`.

### Changed

- Button accepts custom CSS color tones and holds its width in flex layouts.

## 0.1.1-dev.4 — May 6, 2026

### Breaking

- `anta_global_tokens.css` is renamed to `tokens.css`.
- Import `reset.css` for Anta's reset and typography defaults.
- Anta's CSS now lives in `@layer anta`.

### Added

- `table-2`, `sun`, `moon`, and `refresh-ccw-dot` icons.

## 0.1.1-dev.3 — May 5, 2026

### Breaking

- `--text-white` is removed. Use `white` or define a local token.

### Changed

- Dark-mode success, warning, and critical text tokens were retuned.

## 0.1.1-dev.2 — May 3, 2026

### Added

- New icons, accessible Icon labels, and improved Progress announcements.

## 0.1.1-dev.1 — May 3, 2026

### Added

- Apply `.light` to a subtree to restore light tokens below a dark ancestor.

## 0.1.0-dev.1 — May 2, 2026

### Added

- `Text` and `Icon`, global link and list styles, and the initial icon set.

### Notes for upgraders

- Anta now supplies default link, list, and menu styles. Override them with your
  own CSS where needed.

## 0.0.x — through April 2026

Initial package scaffolding, Progress, and the light/dark token system.

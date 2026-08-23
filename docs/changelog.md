# Changelog

This page tracks changes that ship in `@antadesign/anta`. Documentation-only
changes are not listed.

## Unreleased

### Added

- `Steps` provides controlled and uncontrolled process navigation with optional
  panels, horizontal and vertical layouts, accessible tab semantics, process
  states, number and icon-shape markers, state-aware `renderMarker`, labels
  and hints with clipped-content tooltips, and a sequence-wide tone.
- `Loader` accepts a named `tone`; the loading Steps state forwards the
  sequence tone to it.
- `Tabs` and `Steps` accept `fill`. Tabs share the available width equally;
  Steps stretch their connectors between content-sized phases.
- `Steps` adds `primary`, `secondary`, and `tertiary` priorities. Primary uses a
  solid selected marker and stronger completed connectors; tertiary is compact
  and borderless.

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

- `copyLazy` is removed. Keep `copy` reactive and update it from
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

# Accessibility

A few guidelines for designers and engineers using Anta.

## Colors

The matrix renders every text level on every background for the selected tone and theme. Each cell shows the WCAG 2 contrast ratio, AA or AAA result for the selected size and weight, and APCA Lc value. The controls change rendering and pass thresholds, not the color-pair ratios. Vision tabs apply SVG-filter and CSS-mask simulations; the numbers use normal-vision math.

The interactive matrix compares all five text levels with all five background levels for each tone in light and dark mode. It resolves the active CSS palette in the browser, composites transparent text over its background, and reports WCAG 2 contrast and APCA Lc.

Choose the application's palette, tone, font size, and font weight before evaluating a pair. Recheck after changing a theme or seed. The [Colors reference](./colors.md) lists the source declarations for both shipped palettes.

Vision simulations change the displayed sample; contrast results continue to use normal-vision colors. Use simulations alongside text labels and other non-color signals.

Computed contrast cells depend on the selected palette and settings. Evaluate the actual application colors with the [interactive accessibility matrix](https://anta.design/accessibility/).

## System colors

This table uses the browser's system colors directly. It changes with the active
forced-colors palette, so it shows the values a component can use in that mode.

| System colors | Use |
| --- | --- |
| `Canvas`, `CanvasText` | Document background and text |
| `ButtonFace`, `ButtonText`, `ButtonBorder` | Control surface, text, and edge |
| `Field`, `FieldText` | Input field background and text |
| `Highlight`, `HighlightText` | Selected text |
| `SelectedItem`, `SelectedItemText` | Selected control or list item |
| `Mark`, `MarkText` | Marked text, such as &lt;mark&gt; |
| `AccentColor`, `AccentColorText` | Accented control |
| `LinkText` | Unvisited link text |
| `VisitedText` | Visited link text |
| `ActiveText` | Active link text |
| `GrayText` | Disabled text |

## Color is not a unique communication channel

A color-only message fails when a reader cannot distinguish its color. This includes color blindness, low contrast, low brightness, monochrome printing, glare, and theme changes.

`tone` on `Progress`, `Text`, backgrounds, and borders is a secondary signal. Pair it with text and, where useful, a distinct icon shape such as a checkmark or cross.

The simulator above makes it easy to check a candidate combination across the most common color-vision deficiencies and a handful of other vision conditions.

## Low-priority text and contrast

The `Text`/`Title` `quaternary` priority (`text-4`) and the `text-5` step (the faintest — used for disabled and hint text across components) sit at intentionally muted contrast, designed for non-essential metadata: timestamps, captions, helper hints, secondary counters. At small sizes (13–15 px) they may not pass WCAG AA against some background levels and tones. Use the matrix above to verify combinations before relying on them for content that has to be readable.

`text-1` and `text-2` are the primary-content priorities; reach for them whenever the content matters.

## Truncated text and screen readers

When `Text` is `truncated` *without* `expandable`, the hidden portion is also hidden from the accessibility tree — the visible ellipsis is what AT reads, exactly like sighted users see. This is intentional: the content the user *can* see is what gets read. If the truncated content matters, set `expandable` too — the chevron is keyboard-discoverable, focus-visible, and Enter/click reveals the rest.

## ARIA lives in JSX wrappers, not in web components

Anta's web components (`<a-progress>`, `<a-text>`, `<a-icon>`, …) are **pure declarative DOM**. They never set ARIA attributes from JS — no `setAttribute` from constructors or `attributeChangedCallback`. ARIA wiring (`role`, `aria-label`, `aria-valuenow`, etc.) is layered on by the JSX wrappers (`Progress`, `Icon`, `Text`) as ordinary attribute pass-through. If you write the elements by hand instead of via the wrappers, you're responsible for the ARIA bits — the elements stay DOM-clean either way.

This means consumers in other reactive engines (Worker-driven UIs, plain HTML, hand-rolled JSX) get web components that don't fight their state model, while React/Preact users get accessible defaults out of the box from the wrappers.

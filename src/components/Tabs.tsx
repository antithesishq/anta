// Hooks come from the jsx-runtime indirection (configurable via `configure()`), not a
// hard `react` import — so a custom runtime resolves them. Tabs holds the active value
// only to render the strip's roving tabindex (like RadioGroup); the PANELS are
// self-managing `<a-tabpanel>` elements that read the active value from `<a-tabs>` and
// hide themselves — Tabs never reads or toggles them, so there's no child introspection
// (no `Children`/Fragment scan or component-identity matching), which keeps it compatible
// across React / Preact / custom runtimes and static SSR.
import { useState } from "../jsx-runtime"
import { nativeStateChange, optionPresentationAttrs, toneStyle, roundStyle, roundAttr, wrapLabel } from "../anta_helpers"
import type { BaseProps, OptionPresentationProps } from "../general_types"
import type { IconShape } from "../elements/a-icon.shapes"
import { Tooltip } from "./Tooltip"

/** The element's `statechange` payload — `next`/`prev` are tab values (`null` = none). */
type StateDetail = { next: string | null; prev: string | null }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed as the 2nd argument to `onValueChange`. */
export interface TabsChangeAttrs {
  value: string | null
}

/** One tab as a plain data object for the `options` array — the single source `Tabs`
 *  renders its strip from (like `RadioGroup`'s `options`). `Tabs` reads these fields to
 *  render the underlying `<a-tab>` (`tabindex`, `role`, and selection are all `Tabs`'
 *  job, published off-DOM by the element). */
export interface TabOption extends OptionPresentationProps {
  /** This tab's identity — pairs it with the `<TabPanel value="…">` of the same
   *  value, and the value reported by `onStateChange` / `onChange`. Unique per strip. */
  value: string
  /** Visible label. The string shorthand for the tab's content; for richer content
   *  pass `children` instead (`label` wins when both are set). */
  label?: React.ReactNode
  /** Tab content when you need more than a string — used if `label` is omitted. */
  children?: React.ReactNode
  /** Leading icon shape, rendered before the label. */
  icon?: IconShape
  /** Trailing icon shape, rendered after the label. */
  iconTrailing?: IconShape
  /** Fully-round just this tab's box. `<Tabs round>` rounds the whole strip
   *  (tabs + sliding indicator) instead. */
  round?: boolean
  /** Per-tab tone override, same vocabulary as `<Tabs tone>` — colors this one tab's
   *  label + icons (all priorities/modes, named or custom color) and, when it's the
   *  active tab, its indicator. For a **custom literal color** the sliding indicator can't
   *  adopt it (the shared moving element can't read a descendant's color), so a custom tone
   *  colors the label everywhere and the indicator only in `noslide`; the six **named**
   *  tones color both in every mode. Overrides the strip's `tone` for this tab.
   *  @defaultValue inherits the strip's `tone` */
  tone?: "neutral" | "brand" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Disable just this tab — skipped by keyboard nav and dropped from the tab order
   *  (a disabled-but-selected tab stays reachable, per the ARIA pattern). */
  disabled?: boolean
  /** Tooltip for this tab — a string or any node — shown **only when the tab's label
   *  is truncated** (tabs ellipsize when the strip overflows), so a clipped tab reveals
   *  its full text on hover while a tab that fits shows nothing. Rendered as a
   *  `truncatedOnly` `<Tooltip>` anchored to the tab. For an always-visible tooltip or
   *  other custom trigger content, use `children` with your own `<Tooltip>` instead. */
  tooltip?: React.ReactNode
}

/** Public props for `<Tabs>`. */
export interface TabsProps extends Omit<BaseProps, "onChange"> {
  /** Optional `<TabPanel value="…">` panels, one per tab value. Each is a
   *  self-managing `<a-tabpanel>` that shows itself when its `value` is the active
   *  tab. Omit them to use `Tabs` as a bare selectable strip. To place panels in a
   *  different layout region, or to unmount an inactive panel, drive selection with
   *  a controlled `value` and render the content yourself (see the docs). */
  children?: React.ReactNode
  /** The tabs, as a data array (the strip's single source). Each entry is a
   *  `TabOption` (`value`, `label` or `children`, `icon`, `iconTrailing`, `tone`,
   *  `disabled`, `round`, `className`, `style`). `className` and `style` land on
   *  that option's individual `<a-tab>`, not on the strip. */
  options?: TabOption[]
  /** Controlled active value — the tab `value` to mark selected (and, when a
   *  `<TabPanel value="…">` shares it, the panel to reveal). When set, you own
   *  selection: the strip renders exactly what this says, and a user pick only
   *  *requests* a change via `onStateChange` — apply it by updating this prop.
   *  Leave undefined (and use `defaultValue`) for uncontrolled. */
  value?: string
  /** Initial active value for the uncontrolled case. After first render `Tabs`
   *  owns selection itself. */
  defaultValue?: string
  /** Fired whenever the active tab changes — event-first. `detail` is
   *  `{ next, prev }` (values; `null` = none). Cancelable: `event.preventDefault()`
   *  vetoes it (uncontrolled), or in controlled mode answer by updating `value`. */
  onStateChange?: (event: StateChangeEvent, detail: StateDetail) => void
  /** Fired *after* the active tab changes — a native `change` event. */
  onChange?: (event: Event) => void
  /** Like `onChange`, but with a `{ value }` snapshot as the 2nd argument. */
  onValueChange?: (event: Event, attrs: TabsChangeAttrs) => void
  /** Focus entered the strip (any tab) — wired to `focusin` (focus lands on a tab,
   *  not the tablist). */
  onFocus?: (event: FocusEvent) => void
  /** Focus left the strip entirely — wired to `focusout`. */
  onBlur?: (event: FocusEvent) => void
  /** Accessible name for the tablist (`aria-label`). */
  label?: string
  /** Visual priority. `primary` is the raised pill on a recessed track (the
   *  segmented-control look); `secondary` keeps that sizing but drops the track, marking
   *  the selected tab with a subtle active background fill; `tertiary` is a bottom-underline
   *  indicator under the selected tab (no track, no rest line). `tone` colors `secondary` +
   *  `tertiary`; `primary` stays neutral.
   *  @defaultValue 'primary' */
  priority?: "primary" | "secondary" | "tertiary"
  /** Tone applied to the selected indicator/label, or any literal CSS color for a
   *  one-off custom tone (derived in oklch). Named tones track light/dark.
   *  @defaultValue 'neutral' */
  tone?: "neutral" | "brand" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Size — small 24px · medium 28px · large 32px tall, matching Button's scale (the tab's
   *  label leading runs a touch tighter, offset by 1px more block padding per side).
   *  @defaultValue 'medium' */
  size?: "small" | "medium" | "large"
  /** Layout + arrow-key axis. Horizontal ellipsizes labels when tabs overflow (scroll
   *  is opt-in via CSS); vertical stacks them.
   *  @defaultValue 'horizontal' */
  orientation?: "horizontal" | "vertical"
  /** Makes horizontal tabs share the available inline space equally.
   *  @defaultValue false */
  fill?: boolean
  /** Disable the sliding indicator. By default the selected-tab indicator animates
   *  between tabs (a single rectangle, via CSS anchor positioning); `noslide` paints it
   *  per tab so it snaps with no movement. (Browsers without anchor positioning get that
   *  per-tab paint automatically — `noslide` is the explicit opt-out.) */
  noslide?: boolean
  /** Fully-round the tabs and the sliding indicator (and the primary track
   *  well). Applies strip-wide; a single tab's `round` rounds just that tab. A
   *  `number` (px) or CSS length string sets a custom radius on the top-level
   *  track well only — the tab pills + indicator stay fully round. */
  round?: boolean | number | string
  /** Disable the whole strip. */
  disabled?: boolean
}

/**
 * `<Tabs>` — a tablist with optional panels. The strip renders from the `options`
 * array; panels are `<TabPanel>` children that manage their own visibility.
 *
 * The strip (`<a-tabs>`) and the panels render as flat siblings — there is no wrapper
 * element, so `className` / `id` / `style` / `...rest` land on the strip. Laying the
 * strip out relative to its panels is the consumer's job: a horizontal strip stacks
 * above the panels in normal flow; for a vertical strip beside them, wrap `<Tabs>` in
 * your own flex container. Any non-`TabPanel` children render verbatim as siblings too.
 *
 * `<a-tabs>` owns selection off-DOM (it sets each tab's `selected` property and the
 * roving `aria-activedescendant` via `ElementInternals`, writing no attribute to any
 * tab); this wrapper mirrors the value only to render the strip's roving `tabindex`,
 * and the panels read it straight from `<a-tabs>`. Controlled (`value` + `onStateChange`)
 * or uncontrolled (`defaultValue`).
 *
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @example
 * ```tsx
 * <Tabs
 *   defaultValue="account"
 *   label="Settings"
 *   options={[
 *     { value: "account", label: "Account", icon: "user" },
 *     { value: "security", label: "Security" },
 *   ]}
 * >
 *   <TabPanel value="account"><AccountForm /></TabPanel>
 *   <TabPanel value="security"><SecurityForm /></TabPanel>
 * </Tabs>
 * ```
 */
export const Tabs = ({
  children,
  options,
  value,
  defaultValue,
  onStateChange,
  onChange,
  onValueChange,
  onFocus,
  onBlur,
  label,
  priority,
  tone,
  size,
  orientation,
  fill,
  noslide,
  round,
  disabled,
  className,
  style,
  id,
  ...rest
}: TabsProps) => {
  const controlled = value !== undefined
  // Uncontrolled selection lives here (re-renders declaratively) — the wrapper needs
  // the value only to render the strip's roving `tabindex`. Panels read the value
  // straight from `<a-tabs>`, so they don't depend on this mirror.
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue)
  const currentValue = controlled ? value : internalValue

  const tabs = options ?? []

  // Values are a tab's identity — duplicates make selection ambiguous. Warn (only ever
  // fires on the bug itself), matching RadioGroup / a-input's bare console.warn.
  const seen = new Set<string>()
  for (const t of tabs) {
    if (seen.has(t.value))
      console.warn(`[anta] <Tabs> duplicate option value=${JSON.stringify(t.value)} — values must be unique.`)
    seen.add(t.value)
  }

  const onstatechange = (e: StateChangeEvent) => {
    const { event, detail } = nativeStateChange<StateDetail>(e)
    if (!detail) return
    onStateChange?.(event, detail)
    if (controlled) return
    if (event.defaultPrevented) return
    setInternalValue(detail.next ?? undefined)
  }

  const onchange =
    onChange || onValueChange
      ? (e: Event) => {
          onChange?.(e)
          onValueChange?.(e, { value: (e.currentTarget as any)?.value ?? null })
        }
      : undefined

  const vertical = orientation === "vertical"

  const strip = (
    <a-tabs
      role="tablist"
      aria-label={label}
      aria-orientation={vertical ? "vertical" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      // Controlled → drive the element's `state`. Uncontrolled → seed `default-state`
      // and let the ELEMENT own selection (off-DOM via each tab's `selected` property)
      // — so the strip works even unhydrated or hand-assembled. Either way the panels
      // read the value from here, and the wrapper's mirror (kept current via
      // `onstatechange`) feeds the roving `tabindex`.
      state={controlled ? value : undefined}
      default-state={!controlled ? defaultValue : undefined}
      priority={priority && priority !== "primary" ? priority : undefined}
      tone={tone && tone !== "neutral" ? tone : undefined}
      size={size && size !== "medium" ? size : undefined}
      orientation={vertical ? "vertical" : undefined}
      fill={fill ? "" : undefined}
      noslide={noslide ? "" : undefined}
      round={roundAttr(round)}
      disabled={disabled ? "" : undefined}
      onstatechange={onstatechange}
      onchange={onchange}
      // Focus lands on a tab, not the tablist — report via bubbling focusin/focusout.
      onfocusin={onFocus}
      onfocusout={onBlur}
      class={className}
      id={id}
      style={roundStyle(round, "--tabs-round", toneStyle(tone, "--tabs-tone-source", style))}
      {...rest}
    >
      {tabs.map((p) => {
        const tabDisabled = disabled || p.disabled
        const isSelected = p.value === currentValue
        const { className: optionClassName, style: optionStyle, ...optionAttrs } = optionPresentationAttrs(p)
        const tab = (
          <a-tab
            key={p.value}
            {...optionAttrs}
            role="tab"
            value={p.value}
            // Per-tab tone override: named/custom pass the attribute (CSS keys off it),
            // and a custom literal color also sets --tabs-tone-source on the tab.
            tone={p.tone && p.tone !== "neutral" ? p.tone : undefined}
            aria-disabled={tabDisabled ? "true" : undefined}
            // Every enabled tab is its own tab stop (not a roving single stop) — Tab /
            // Shift+Tab step through them; arrows move + select via the element. A
            // disabled tab leaves the tab order (-1) UNLESS it's the selected one, which
            // stays focusable so AT can reach the active tab. `aria-selected` and the
            // panel `aria-labelledby` link are published off-DOM by the elements.
            tabIndex={tabDisabled && !isSelected ? -1 : 0}
            disabled={tabDisabled ? "" : undefined}
            round={roundAttr(round) ?? roundAttr(p.round)}
            class={optionClassName}
            style={toneStyle(p.tone, "--tabs-tone-source", optionStyle)}
          >
            {p.icon && <a-icon shape={p.icon} aria-hidden="true" />}
            {wrapLabel(p.label != null ? p.label : p.children, "a-tab-label")}
            {p.iconTrailing && <a-icon shape={p.iconTrailing} aria-hidden="true" />}
            {/* Per-tab tooltip: a truncatedOnly Tooltip anchored to the tab, so it
                surfaces only when the label ellipsizes. It finds the tab's
                <a-tab-label> automatically (see a-tooltip's TRUNCATING_PARTS). */}
            {p.tooltip != null && p.tooltip !== "" ? (
              <Tooltip truncatedOnly>{p.tooltip}</Tooltip>
            ) : null}
          </a-tab>
        )
        return tab
      })}
    </a-tabs>
  )

  // The strip and its panels (any children) render as flat siblings — no wrapper element,
  // so the `class` / `id` / `style` / `rest` above land on the strip, the one consistent
  // root. Arranging the strip relative to its panels is the consumer's job: a horizontal
  // strip stacks above the panels in normal flow; for a vertical strip beside them, wrap
  // `<Tabs>` in your own flex container (see the docs). Panels find the strip as a sibling
  // (`a-tabpanel` → `:scope > a-tabs`), so keep them under one parent — or drive a
  // controlled `value` when you split them into separate regions.
  return (
    <>
      {strip}
      {children}
    </>
  )
}

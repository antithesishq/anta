// Hooks come from the jsx-runtime indirection (configurable via `configure()`), not a
// hard `react` import — so a custom runtime resolves them. Tabs holds the active value
// only to render the strip's roving tabindex (like RadioGroup); the PANELS are
// self-managing `<a-tabpanel>` elements that read the active value from `<a-tabs>` and
// hide themselves — Tabs never reads or toggles them, so there's no child introspection
// (no `Children`/Fragment scan, no component-identity matching), which keeps it robust
// across React / Preact / custom runtimes and static SSR.
import { useState } from "../jsx-runtime"
import { nativeStateChange, toneStyle, roundStyle, wrapLabel } from "../anta_helpers"
import type { BaseProps } from "../general_types"
import type { IconShape } from "../elements/a-icon.shapes"
import styles from "./Tabs.module.css"

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
export interface TabOption {
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
  /** Per-tab tone override, same vocabulary as `<Tabs tone>` — colours this one tab's
   *  label + icons (all priorities/modes, named or custom colour) and, when it's the
   *  active tab, its indicator. For a **custom literal colour** the sliding indicator can't
   *  adopt it (the shared moving element can't read a descendant's colour), so a custom tone
   *  colours the label everywhere and the indicator only in `noslide`; the six **named**
   *  tones colour both in every mode. Overrides the strip's `tone` for this tab.
   *  @defaultValue inherits the strip's `tone` */
  tone?: "neutral" | "brand" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Disable just this tab — skipped by keyboard nav and dropped from the tab order
   *  (a disabled-but-selected tab stays reachable, per the ARIA pattern). */
  disabled?: boolean
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
   *  `disabled`, `round`). */
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
   *  indicator under the selected tab (no track, no rest line). `tone` colours `secondary` +
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

/** True when `children` holds at least one renderable node (panels present). */
const hasRenderable = (children: React.ReactNode): boolean =>
  Array.isArray(children)
    ? children.some((c) => c != null && c !== false && c !== true)
    : children != null && children !== false && children !== true

/**
 * `<Tabs>` — a tablist with optional panels. The strip renders from the `options`
 * array; panels are `<TabPanel>` children that manage their own visibility.
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
  // The strip is the root unless there's something to lay out around it — panels (they
  // stack under, or beside when vertical) or a vertical strip. Otherwise a wrapper
  // `<div>` would just be a redundant box, so the bare strip is returned and takes the
  // consumer's className / style / id / rest.
  const needsContainer = hasRenderable(children) || vertical

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
      noslide={noslide ? "" : undefined}
      round={round ? "" : undefined}
      disabled={disabled ? "" : undefined}
      onstatechange={onstatechange}
      onchange={onchange}
      // Focus lands on a tab, not the tablist — report via bubbling focusin/focusout.
      onfocusin={onFocus}
      onfocusout={onBlur}
      class={needsContainer ? undefined : className}
      id={needsContainer ? undefined : id}
      // `style` always lands on <a-tabs> — you style the strip, even when a container
      // wraps the panels; `class` / `id` / `rest` go on that container root instead.
      style={roundStyle(round, "--tabs-round", toneStyle(tone, "--tabs-tone-source", style))}
      {...(needsContainer ? {} : rest)}
    >
      {tabs.map((p) => {
        const tabDisabled = disabled || p.disabled
        const isSelected = p.value === currentValue
        return (
          <a-tab
            key={p.value}
            role="tab"
            value={p.value}
            // Per-tab tone override: named/custom pass the attribute (CSS keys off it),
            // and a custom literal colour also sets --tabs-tone-source on the tab.
            tone={p.tone && p.tone !== "neutral" ? p.tone : undefined}
            style={toneStyle(p.tone, "--tabs-tone-source", undefined)}
            aria-disabled={tabDisabled ? "true" : undefined}
            // Every enabled tab is its own tab stop (not a roving single stop) — Tab /
            // Shift+Tab step through them; arrows move + select via the element. A
            // disabled tab leaves the tab order (-1) UNLESS it's the selected one, which
            // stays focusable so AT can reach the active tab. `aria-selected` and the
            // panel `aria-labelledby` link are published off-DOM by the elements.
            tabIndex={tabDisabled && !isSelected ? -1 : 0}
            disabled={tabDisabled ? "" : undefined}
            round={round || p.round ? "" : undefined}
          >
            {p.icon && <a-icon shape={p.icon} aria-hidden="true" />}
            {wrapLabel(p.label != null ? p.label : p.children, "a-tab-label")}
            {p.iconTrailing && <a-icon shape={p.iconTrailing} aria-hidden="true" />}
          </a-tab>
        )
      })}
    </a-tabs>
  )

  // No panels, horizontal → the strip is the whole component; skip the wrapper div.
  if (!needsContainer) return strip

  return (
    <div
      className={className ? `${styles.container} ${className}` : styles.container}
      data-orientation={vertical ? "vertical" : undefined}
      id={id}
      {...rest}
    >
      {strip}
      {/* Panels — self-managing `<a-tabpanel>`s, passed through untouched. */}
      {children}
    </div>
  )
}

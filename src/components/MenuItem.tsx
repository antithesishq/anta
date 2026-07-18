import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import type { CopyMode } from './Button'
import { toneStyle, nativeStateChange } from '../anta_helpers'

/** Props shared by every menu item, link or not. */
export interface MenuItemCommonProps extends BaseProps {
  /** Leading icon shape. */
  icon?: IconShape
  /** The item's text. Usually a string, but any node is accepted — e.g. a filtered
   *  `Select` bolds the matched substring. Omit and pass `children` for richer
   *  content. */
  label?: React.ReactNode
  /** Secondary text under the label — explanatory copy, like `RadioGroup`'s
   *  option `hint`. Requires `label` (it stacks in a column beneath it). Muted
   *  (`--text-3`) and tracks the row's `tone`. A string, or any node. */
  hint?: React.ReactNode
  /** A trailing keyboard-shortcut hint, e.g. `"⌘E"`. */
  kbd?: string
  /** A trailing icon. On a `submenu` item this **overrides** the default
   *  chevron (omit it to keep the chevron); on a normal item it's the trailing
   *  glyph (omit for none). */
  iconTrailing?: IconShape
  /** Disable the item: greyed out, not focusable for activation, no close. A
   *  disabled link also drops its `href`, so it can't navigate. */
  disabled?: boolean
  /** Mark the item as selected. On a plain row (no `selectionIndicator`) this is
   *  a persistent background tint, the same resting fill a pressed row shows —
   *  also the way to flag the current page on a link item. On a checkable row
   *  (`selectionIndicator` set) it instead drives the leading `checkbox` / `radio`
   *  indicator and the row's `aria-checked`. */
  selected?: boolean
  /** Semantic tone — colors the label, icon, and hover/selected tint (and the
   *  `checkbox`/`radio` indicator, which adopts it). A named tone, or any literal
   *  CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone whose
   *  hue + chroma are kept while the lightness is pinned to match the brand text.
   *  `critical` is the destructive action; `neutral` (the default) is the standard
   *  gray.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Like `tone`, but applied only while the row is `selected` — an unselected row
   *  stays neutral. The whole selected row (label, icon, tint, and the `checkbox` /
   *  `radio` indicator) takes the tone. Same value set as `tone`; on a selected row
   *  `toneSelected` wins over `tone` when both are set.
   *  @defaultValue neutral */
  toneSelected?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** An opaque value identifying this item, handed back in `onSelect`'s detail
   *  so a shared handler can tell which row was chosen without a per-item
   *  closure. */
  value?: string | number
  /** Activation handler — fires when *this* item is chosen (click / Enter /
   *  Space), unless it's `disabled`. It does **not** fire for a submenu parent
   *  (clicking that opens the flyout, which isn't a selection) nor for a
   *  selection bubbling up from a nested submenu. On a link item it fires
   *  alongside the navigation. Receives the event plus a `{ value, label }`
   *  detail. */
  onSelect?: (event: any, detail: { value?: string | number; label?: React.ReactNode }) => void
  /** Raw `mousedown` on the row. Mainly to `preventDefault()` so the row doesn't
   *  take focus on a mouse press — e.g. a combobox option keeping focus in its
   *  input field while the click still selects. */
  onMouseDown?: (event: any) => void
  /** ARIA role override. Defaults to the role implied by `selectionIndicator`
   *  (`menuitem` / `menuitemcheckbox` / `menuitemradio`); set it to reparent the
   *  row under a different container role — e.g. `option` inside a `listbox`. */
  role?: string
  /** Item content. With `label` set, children are extra content — most
   *  notably the nested `<Menu>` for a submenu parent. */
  children?: React.ReactNode
}

export type MenuItemLinkMode = {
  /** Renders the item as `<a role="menuitem" data-anta-menu-item href>`. */
  href: string
  /** Anchor target, e.g. `'_blank'`. */
  target?: string
  /** Anchor rel. */
  rel?: string
  /** Download the resource instead of navigating: `true` / `''` uses the
   *  resource's default filename, a string overrides it. */
  download?: string | boolean
  /** Space-separated URLs the browser pings on navigation. */
  ping?: string
  submenu?: never
  selectionIndicator?: never
  indeterminate?: never
  indicator?: never
  copy?: never
  copyNode?: never
  copyLazy?: never
  onCopied?: never
  onCopyRequest?: never
}

export type MenuItemActionMode = {
  href?: never
  target?: never
  rel?: never
  download?: never
  ping?: never
  /** Marks this item as a submenu parent: adds the trailing chevron and
   *  `aria-haspopup="menu"`. Nest the flyout as a `<Menu>` child. */
  submenu?: boolean
  /** Turn the row into a checkable item, driven by `selected` (the row stays the
   *  control and carries `aria-checked`):
   *  - `'checkbox'` → `role="menuitemcheckbox"`, a leading passive `<a-checkbox>`
   *    (before `icon`); the tint is dropped (the box carries state).
   *  - `'radio'` → `role="menuitemradio"`, a leading passive `<a-radio>`; tint dropped.
   *  - `'check'` → `role="menuitemradio"`, a trailing check glyph on the selected
   *    row *and* the background tint (the canonical single-select look).
   *  Omit for a plain row (the default). */
  selectionIndicator?: 'checkbox' | 'radio' | 'check'
  /** Only meaningful with `selectionIndicator="checkbox"`: render the box in the
   *  mixed state (`aria-checked="mixed"`) — e.g. a "Select all" row when some but
   *  not all of its options are selected. */
  indeterminate?: boolean
  /** Replace the built-in selection-indicator *visual* with your own node,
   *  rendered at the **leading** edge (where the checkbox / radio sit). Pair with
   *  `selectionIndicator` to keep the semantics — the row stays the control and
   *  carries `role` + `aria-checked`; only the drawn mark changes. Suppresses the
   *  built-in checkbox / radio and the trailing `check` glyph. The node is made
   *  passive (aria-hidden, no pointer events) so the row owns the click. */
  indicator?: React.ReactNode
}

// Copy props (a "copying menu item") live on the action branch only — a link
// item can't copy. The shared `CopyMode` union enforces that exactly one of
// `copy` / `copyNode` / `copyLazy` is set; `MenuItemCopy` is the preset. The menu
// closes on select as usual (add `data-menu-open` to linger on the success state).
export type MenuItemProps = MenuItemCommonProps &
  (MenuItemLinkMode | (MenuItemActionMode & CopyMode))

/**
 * MenuItem — a single selectable row inside a `Menu`. Composes a leading
 * `icon`, a `label` (or `children`), an optional trailing `kbd` hint, and an
 * optional trailing icon. For a submenu, set `submenu` and nest a
 * `<Menu>` as a child — a chevron is added automatically.
 *
 * Selecting an item closes the menu; add `data-menu-open` to keep it open
 * (toggles / multi-select) — it forwards to the element.
 *
 * @example
 * ```tsx
 * <MenuItem icon="copy" label="Duplicate" kbd="⌘D" onSelect={dup} />
 * <MenuItem label="Word wrap" data-menu-open onSelect={toggleWrap} />
 * <MenuItem label="Share" submenu>
 *   <Menu>
 *     <MenuItem label="Copy link" onSelect={copyLink} />
 *   </Menu>
 * </MenuItem>
 * ```
 */
export const MenuItem = ({
  icon,
  label,
  hint,
  kbd,
  iconTrailing,
  disabled,
  selected,
  selectionIndicator,
  indeterminate,
  indicator,
  tone,
  toneSelected,
  submenu,
  value,
  onSelect,
  href,
  target,
  rel,
  download,
  ping,
  copy,
  copyNode,
  copyLazy,
  onCopied,
  onCopyRequest,
  role: roleOverride,
  className,
  style,
  children,
  ...rest
}: MenuItemProps) => {
  // A copy row when any copy prop is set. The element performs the write on
  // `menuselect` and announces it via `copydone`; the leading glyph defaults to
  // `copy` (MenuItemCopy swaps it on the result).
  const isCopy = copy != null || copyNode != null || copyLazy === true
  const leadingIcon = icon ?? (isCopy ? 'copy' : undefined)
  // A checkable row is the control itself: it flips role to menuitem{checkbox,radio}
  // and carries aria-checked. The leading `checkbox`/`radio` styles render a passive
  // <a-checkbox>/<a-radio> and drop the tint (the mark conveys state); the `check`
  // style instead keeps the tint and adds a trailing check glyph. So `selected=""`
  // (the tint) is emitted for plain rows *and* the `check` style.
  const checkable =
    selectionIndicator === 'checkbox' || selectionIndicator === 'radio' || selectionIndicator === 'check'
  const role =
    selectionIndicator === 'checkbox'
      ? 'menuitemcheckbox'
      : selectionIndicator === 'radio' || selectionIndicator === 'check'
        ? 'menuitemradio'
        : 'menuitem'
  const ariaChecked = !checkable
    ? undefined
    : selectionIndicator === 'checkbox' && indeterminate
      ? 'mixed'
      : selected
        ? 'true'
        : 'false'
  const keepTint = selected && (selectionIndicator === undefined || selectionIndicator === 'check')
  // `toneSelected` tones the whole row (text, icon, tint, indicator) only while the
  // row is selected; `tone` tones it always. On a selected row toneSelected wins.
  const effectiveTone = (selected && toneSelected) || tone
  // A named tone travels as the attribute; a custom colour also needs its
  // `--{component}-tone-source` var set inline (the typed `attr()` path only
  // resolves on newer engines) — for the host and, so it adopts the row's tone,
  // the checkbox/radio indicator.
  const toneAttr = effectiveTone && effectiveTone !== 'neutral' ? effectiveTone : undefined

  // Label block — shared by the element and link renders. A hint stacks under
  // the label in a column; without it the label is a bare row child.
  const labelNode =
    label != null &&
    (hint != null ? (
      <a-menu-item-text>
        <a-menu-item-label>{label}</a-menu-item-label>
        <a-menu-item-hint>{hint}</a-menu-item-hint>
      </a-menu-item-text>
    ) : (
      <a-menu-item-label>{label}</a-menu-item-label>
    ))

  if (href != null) {
    const linkAttrs = {
      'data-anta-menu-item': '',
      role: roleOverride ?? 'menuitem',
      href: disabled ? undefined : href,
      target,
      rel,
      download: download === true ? '' : download || undefined,
      ping,
      tabIndex: disabled ? -1 : 0,
      'aria-disabled': disabled ? 'true' : undefined,
      'aria-current': selected ? 'true' : undefined,
      tone: toneAttr,
      style: toneStyle(effectiveTone, '--menu-item-tone-source', style),
      onClick: onSelect && !disabled ? (e: any) => onSelect(e, { value, label }) : undefined,
      class: className,
    } as any
    return (
      <a {...linkAttrs} {...rest}>
        {icon && <a-icon shape={icon} aria-hidden="true" />}
        {labelNode}
        {children}
        {kbd && <kbd>{kbd}</kbd>}
        {iconTrailing && <a-icon shape={iconTrailing} aria-hidden="true" />}
      </a>
    )
  }

  return (
    <a-menu-item
      role={roleOverride ?? role}
      tabIndex={0}
      disabled={disabled ? '' : undefined}
      selected={keepTint ? '' : undefined}
      aria-checked={ariaChecked}
      // 'neutral' is the implicit default — emit no DOM attribute.
      tone={toneAttr}
      style={toneStyle(effectiveTone, '--menu-item-tone-source', style)}
      submenu={submenu ? '' : undefined}
      aria-haspopup={submenu ? 'menu' : undefined}
      // No `aria-expanded`: keeping it in sync would need the element to flip it
      // (a light-DOM mutation that desyncs the worker-thread reactive model) or
      // reactive state here for one attribute — not worth it. A static value would
      // just lie once the submenu opens, so it's omitted; `aria-haspopup` still
      // announces the submenu, and the open branch's visual rides the nested
      // a-menu's off-DOM `:state(open)` (see a-menu-item.css).
      aria-disabled={disabled ? 'true' : undefined}
      // Pure projection — no DOM walking. `a-menu` decides which item was
      // genuinely activated (on the UI thread, via the composed path) and fires a
      // pre-filtered `menuselect` on it (skipping submenu parents + bubbled child
      // clicks). It's a MouseEvent, so `onSelect` still sees the modifier keys
      // (e.g. `Select`'s Alt/Option-click isolate reads `altKey`).
      onmenuselect={onSelect ? (e: any) => onSelect(e, { value, label }) : undefined}
      // Copy behavior — the element writes to the clipboard on `menuselect`.
      copy={copy != null ? copy : undefined}
      copy-node={copyNode === true ? '' : typeof copyNode === 'string' ? copyNode : undefined}
      copy-lazy={copyLazy ? '' : undefined}
      data-copy-node-button={copyNode != null && copyNode !== false ? '' : undefined}
      oncopydone={onCopied ? (e: any) => onCopied(nativeStateChange<{ ok: boolean }>(e).detail?.ok ?? false) : undefined}
      oncopyrequest={
        onCopyRequest
          ? (e: any) => onCopyRequest(nativeStateChange<{ provide: (text: string) => void }>(e).detail!.provide)
          : undefined
      }
      class={className}
      {...rest}
    >
      {/* Passive selection indicator at the leading edge — the row is the actual
          control (role + aria-checked), so the mark is decorative. A custom
          `indicator` node wins (rendered passive: aria-hidden + no pointer events,
          `flex: none` so the row's flex `gap` spaces it, matching the built-ins);
          otherwise reuse the checkbox/radio *element* visuals (no role, no focus,
          no form value). a-menu-item.css handles the built-ins' gap/pointer-events. */}
      {indicator != null ? (
        // `min-height: 1lh` makes the wrapper one text line tall and centres the node
        // in it, so a small indicator aligns with the label's first line in a hinted
        // (top-aligned) row instead of riding at the top.
        <span
          aria-hidden="true"
          data-indicator=""
          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '1lh', pointerEvents: 'none' }}
        >
          {indicator}
        </span>
      ) : selectionIndicator === 'checkbox' ? (
        <a-checkbox
          aria-hidden="true"
          state={indeterminate ? 'indeterminate' : selected ? 'checked' : 'unchecked'}
          tone={toneAttr}
          style={toneStyle(effectiveTone, '--checkbox-tone-source')}
        />
      ) : selectionIndicator === 'radio' ? (
        // Real boolean, not the ''/undefined presence form: `a-radio` has a
        // `selected` *property* setter (`applyState(!!on)`), so Preact routes the
        // prop through it — `''` would read as false and never select. A boolean
        // drives the property correctly and clears stale state on deselect. (The
        // checkbox above is safe: its `state` is attribute-only, no property.)
        <a-radio
          aria-hidden="true"
          selected={!!selected}
          tone={toneAttr}
          style={toneStyle(effectiveTone, '--radio-tone-source')}
        />
      ) : null}
      {leadingIcon && <a-icon shape={leadingIcon} aria-hidden="true" />}
      {labelNode}
      {/* Children sit after the label but before `kbd` and the trailing icon, so
          a slotted badge / counter (a `<Tag>`) lands just left of the shortcut
          hint / chevron rather than past it. The label's `flex: 1` right-aligns
          them. A submenu's nested `<a-menu>` is a child too, so it's no longer
          the item's last child — the `[submenu]`-scoped CSS positions the chevron
          without relying on that (see a-menu-item.css). */}
      {children}
      {kbd && <kbd>{kbd}</kbd>}
      {(() => {
        // A submenu shows the chevron by default; `iconTrailing` overrides it. The
        // `check` selection style reserves a trailing slot on *every* row — a check
        // on the selected row, an invisible `blank` spacer on the rest — so the label
        // and end padding don't shift as the selection moves.
        let trailing = submenu ? (iconTrailing ?? 'chevron-right') : iconTrailing
        // A custom leading `indicator` replaces the mark entirely — no trailing check.
        if (!submenu && !iconTrailing && selectionIndicator === 'check' && indicator == null)
          trailing = selected ? 'check' : 'blank'
        return trailing ? <a-icon shape={trailing} aria-hidden="true" /> : null
      })()}
    </a-menu-item>
  )
}

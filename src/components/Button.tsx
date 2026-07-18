import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'
import { toneStyle, roundStyle, roundAttr, wrapLabel, nativeStateChange } from "../anta_helpers"

/** Always-allowed props, independent of content/submit/priority mode. */
export type BaseButtonProps = {
  /** Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`)
   *  for a one-off custom tone. Primary uses the color as-is; secondary,
   *  tertiary, and quaternary take its hue and pin lightness/chroma to the
   *  brand curve so any input stays legible.
   *  @defaultValue neutral */
  tone?:
    | 'neutral'
    | 'brand'
    | 'info'
    | 'success'
    | 'warning'
    | 'critical'
    | (string & {})
  /** Size variant. small=24px, medium=28px, large=32px. Omit the
   *  attribute or pass `'medium'` for the default — both render
   *  identically and emit no DOM attribute.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Show a rotating loading indicator. Blocks clicks and keyboard
   *  activation, and removes the button from the tab order while active. */
  loading?: boolean
  /** Disable the button. */
  disabled?: boolean
  /** Toggled-on / pressed state, e.g. for filter chips. */
  selected?: boolean
  /** Fully-round corners — a pill for text buttons, a circle for icon-only ones
   *  (`border-radius: 999px`, clamped to the element's height). Pass a `number`
   *  (px) or a CSS length string (`'1rem'`) for a custom radius instead. */
  round?: boolean | number | string
  /** Click handler. */
  onClick?: (e: any) => void
  /** Tab order. The button is keyboard-focusable by default (`0`) and
   *  becomes `-1` automatically while `disabled` or `loading` — `<a-button>`
   *  and `<a role="button">` aren't focusable without an explicit tabindex,
   *  and a loading button must stay out of the tab order so Enter/Space can't
   *  fire it mid-flight.
   *  @defaultValue 0 */
  tabIndex?: number
  /** ARIA role override (e.g. `'gridcell'` when a button is a cell in a grid).
   *  Forwarded to the underlying element.
   *  @defaultValue button */
  role?: string
}

/** Content axis — slots render in this order inside the button:
 *  `icon` → `label` → `children` → `iconTrailing`. Pass `icon` alone
 *  for an icon-only button (the CSS detects this structurally via
 *  `:has(> a-icon:only-child)` and gives the host square padding +
 *  min-size pin). */
export type ContentMode = {
  /** Label text. Renders between the leading icon and `children`. */
  label?: string
  /** Leading icon shape. When set alone (no `label`, no `iconTrailing`, no
   *  `children`), the button renders as a square icon-only control and
   *  the wrapper auto-supplies `aria-label={icon}` (override by passing
   *  your own `aria-label`). */
  icon?: IconShape
  /** Trailing icon shape. Renders after `children`, last in the slot order. */
  iconTrailing?: IconShape
}

/** Submit axis — anchors (href) don't carry form-submission props; buttons
 *  don't carry anchor props. */
export type SubmitMode =
  | {
      /** Renders as `<a role="button">` instead of `<a-button>`. */
      href: string
      /** Anchor target. */
      target?: string
      /** Anchor rel. */
      rel?: string
      /** Anchor download attribute. Empty string / `true` triggers a download with the resource's default name; a string overrides the filename. */
      download?: string | boolean
      /** Space-separated URLs the browser pings on navigation. */
      ping?: string
      type?: never
      form?: never
    }
  | {
      href?: never
      target?: never
      rel?: never
      download?: never
      ping?: never
      /** Form submission type. */
      type?: 'button' | 'submit' | 'reset'
      /** Form id when the button isn't a descendant of its form. */
      form?: string
    }

/** Priority axis — `underline` only on `tertiary` / `quaternary`,
 *  `paddingless` only on `quaternary`. */
export type PriorityMode =
  | {
      /** Visual emphasis.
       *  @defaultValue secondary */
      priority?: 'primary' | 'secondary'
      underline?: never
      paddingless?: never
    }
  | {
      priority: 'tertiary'
      /** Underline style. */
      underline?: 'solid' | 'dashed' | 'dotted'
      paddingless?: never
    }
  | {
      priority: 'quaternary'
      /** Underline style. */
      underline?: 'solid' | 'dashed' | 'dotted'
      /** Drops outer padding to zero. */
      paddingless?: boolean
    }

/** Copy axis — turns the button into a copy control that writes to the clipboard
 *  on click and flashes a success / failure state (see `<a-button>`'s copy
 *  behavior). **Exactly one** of `copy`, `copyNode`, or `copyLazy` may be set;
 *  the union makes the others `never` in each mode. For the batteries-included
 *  preset, use `ButtonCopy`. */
export type CopyMode =
  | {
      copy?: never
      copyNode?: never
      copyLazy?: never
      onCopied?: never
      onCopyRequest?: never
    }
  | {
      /** Text copied to the clipboard on click. */
      copy: string
      copyNode?: never
      copyLazy?: never
      onCopyRequest?: never
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
    }
  | {
      /** Copy a DOM node as rich text instead of a string. `true` copies the
       *  nearest ancestor marked `data-copy-source`; a string is a CSS selector
       *  for an ancestor region (`closest`). The copy control is stripped from
       *  the copied output. */
      copyNode: boolean | string
      copy?: never
      copyLazy?: never
      onCopyRequest?: never
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
    }
  | {
      /** Lazy copy: the content isn't computed or held in the DOM until the
       *  click. The click fires `onCopyRequest(provide)`; call `provide(text)`
       *  with the value — synchronously, or after an `await` (the browser's
       *  transient-activation window still covers the write). */
      copyLazy: true
      copy?: never
      copyNode?: never
      /** Supplies the lazily-computed content on click: call `provide(text)`. */
      onCopyRequest: (provide: (text: string) => void) => void
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
    }

export type ButtonProps = BaseButtonProps & PriorityMode & ContentMode & SubmitMode & CopyMode & BaseProps

/**
 * Action button.
 *
 * Renders an `<a-button>` web component (or `<a role="button">` when
 * `href` is set) with the design system's tone × priority matrix applied
 * via CSS attributes.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * <Button label="Save" onClick={save} />
 * ```
 *
 * @example Anchor styled as a button
 * ```tsx
 * <Button href="/docs" target="_blank" label="Read the docs" />
 * ```
 */
export const Button = ({
  priority,
  tone,
  underline,
  icon,
  iconTrailing,
  paddingless,
  label,
  size,
  loading,
  disabled,
  selected,
  round,
  href,
  type,
  form,
  copy,
  copyNode,
  copyLazy,
  onCopied,
  onCopyRequest,
  className,
  style,
  children,
  ...rest
}: ButtonProps) => {
  // A copy control when any copy prop is set. The leading glyph becomes a stack
  // (idle / success / failure) the element's `:state()` picks from — see
  // a-button.css and copy-behavior.ts.
  const isCopy = copy != null || copyNode != null || copyLazy === true
  // Empty string is "no tone" — same as omitting the prop: neutral base.
  // Don't emit a bare `tone=""` (it matched the custom-tone branch and
  // resolved to a `transparent` source, rendering an invisible button).
  const toneAttr = tone || undefined
  // A non-named tone is a literal CSS color: feed it to the element's oklch
  // derivation via the inline custom property (shared helper — see anta_helpers).
  const computedStyle = roundStyle(round, '--button-round', toneStyle(toneAttr, '--button-tone-source', style))

  // Leading icon: a copy control defaults to the `copy` glyph when no icon is
  // given (ButtonCopy swaps this to check / ✕ on the copy result).
  const leadingIcon = icon ?? (isCopy ? 'copy' : undefined)
  // Icon-only: a leading icon and no text content.
  const isIconOnly =
    leadingIcon != null && label == null && children == null && iconTrailing == null

  const sharedAttrs = {
    // `<a-button>` is a custom element with no implicit ARIA role, so AT would
    // announce it as a generic clickable — and `aria-pressed` below is only
    // valid on a button/switch role. Publish `role="button"` from the wrapper
    // (ARIA lives in the wrapper) for both the element and the `<a href>` path;
    // a consumer's own `role` in `...rest` still wins by spread order.
    role: 'button',
    priority,
    tone: toneAttr,
    underline,
    // 'medium' (and unset) is the implicit default — emit no DOM attr.
    size: size && size !== 'medium' ? size : undefined,
    // Boolean attributes: emit a presence attribute (empty string) when on,
    // omit when off — `attr=""` is the canonical boolean-attribute form and
    // renders consistently across React / Preact. The CSS matches these by
    // presence (`[disabled]`, not `[disabled="true"]`), so any present form
    // works. (ARIA attributes below stay string-valued — ARIA needs "true".)
    paddingless: paddingless ? '' : undefined,
    round: roundAttr(round),
    loading: loading ? '' : undefined,
    disabled: disabled ? '' : undefined,
    selected: selected ? '' : undefined,
    // Disabled AND loading both leave the keyboard tab order — a loading
    // button blocks the mouse (pointer-events), so it must block Enter/Space
    // activation too, else the loading guard would be mouse-only.
    tabIndex: disabled || loading ? -1 : 0,
    'aria-disabled': disabled || loading ? 'true' : undefined,
    'aria-busy': loading ? 'true' : undefined,
    'aria-pressed': selected ? 'true' : undefined,
    // Icon-only buttons get an accessible name: "Copy" for a copy control (its
    // glyph carries no text), else the icon shape. Consumer's own `aria-label`
    // (via ...rest) wins by spread order.
    'aria-label': isIconOnly ? (isCopy ? 'Copy' : icon) : undefined,
    // Copy behavior — the element reads these and performs the write itself.
    copy: copy != null ? copy : undefined,
    'copy-node': copyNode === true ? '' : typeof copyNode === 'string' ? copyNode : undefined,
    'copy-lazy': copyLazy ? '' : undefined,
    // Marks the control so `copy-node` serialization strips it from the copied
    // node (a copy button inside the copied region shouldn't paste itself).
    'data-copy-node-button': copyNode != null && copyNode !== false ? '' : undefined,
    oncopydone: onCopied
      ? (e: any) => onCopied(nativeStateChange<{ ok: boolean }>(e).detail?.ok ?? false)
      : undefined,
    // The element hands `provide` on the request event; forward it so the
    // consumer supplies the lazily-computed content.
    oncopyrequest: onCopyRequest
      ? (e: any) => onCopyRequest(nativeStateChange<{ provide: (text: string) => void }>(e).detail!.provide)
      : undefined,
    class: className,
    style: computedStyle,
  } as const

  const inner = (
    <>
      {leadingIcon && <a-icon shape={leadingIcon} aria-hidden="true" />}
      {label != null && <a-button-label>{label}</a-button-label>}
      {wrapLabel(children, 'a-button-label')}
      {iconTrailing && <a-icon shape={iconTrailing} aria-hidden="true" />}
    </>
  )

  if (href != null) {
    // type / form intentionally omitted — anchors don't submit forms.
    // `data-anta` opts this anchor into Anta's `a[role="button"]` styling.
    // The role is generic (any widget emits `role="button"`), so the CSS
    // only styles anchors carrying this marker — the wrapper adds it here so
    // the button look is automatic, while foreign `<a role="button">` (e.g.
    // Monaco's) stays untouched. A consumer's own `data-anta` in `...rest`
    // still passes through. The `<a-button>` branch below needs no marker —
    // Anta owns that tag and styles it unconditionally.
    return (
      <a
        href={href}
        data-anta=""
        {...sharedAttrs as any}
        {...rest}
      >
        {inner}
      </a>
    )
  }

  return (
    <a-button
      type={type}
      form={form}
      {...sharedAttrs}
      {...rest}
    >
      {inner}
    </a-button>
  )
}

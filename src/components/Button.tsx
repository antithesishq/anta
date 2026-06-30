import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'
import { toneStyle, wrapLabel } from "../anta_helpers"

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
   *  Forwarded to the underlying element; defaults to the element's own role. */
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

export type ButtonProps = BaseButtonProps & PriorityMode & ContentMode & SubmitMode & BaseProps

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
  href,
  type,
  form,
  className,
  style,
  children,
  ...rest
}: ButtonProps) => {
  // Empty string is "no tone" — same as omitting the prop: neutral base.
  // Don't emit a bare `tone=""` (it matched the custom-tone branch and
  // resolved to a `transparent` source, rendering an invisible button).
  const toneAttr = tone || undefined
  // A non-named tone is a literal CSS color: feed it to the element's oklch
  // derivation via the inline custom property (shared helper — see anta_helpers).
  const computedStyle = toneStyle(toneAttr, '--button-tone-source', style)

  const isIconOnly =
    icon != null && label == null && children == null && iconTrailing == null

  const sharedAttrs = {
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
    // Icon-only buttons get an accessible name from the icon shape;
    // consumer's own `aria-label` (via ...rest) wins by spread order.
    'aria-label': isIconOnly ? icon : undefined,
    class: className,
    style: computedStyle,
  } as const

  const inner = (
    <>
      {icon && <a-icon shape={icon} aria-hidden="true" />}
      {label != null && <a-button-label>{label}</a-button-label>}
      {wrapLabel(children, 'a-button-label')}
      {iconTrailing && <a-icon shape={iconTrailing} aria-hidden="true" />}
    </>
  )

  if (href != null) {
    // type / form intentionally omitted — anchors don't submit forms.
    return (
      <a
        href={href}
        role="button"
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

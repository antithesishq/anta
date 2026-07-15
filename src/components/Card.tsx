import type { BaseProps } from "../general_types"
import { toneStyle, roundStyle } from "../anta_helpers"

export interface CardProps extends BaseProps {
  /** Header content, rendered in the top zone with the default title
   *  typography. A string is respected as-is; pass a `<Title>` (or `<h2>`–`<h6>`)
   *  for real heading semantics in the document outline. Omit for no header. */
  header?: React.ReactNode
  /** Footer content, usually action buttons. Rendered as a **left-aligned** row
   *  (wraps under pressure) — the opposite of `Dialog`'s right-aligned footer. */
  footer?: React.ReactNode
  /** Controls rendered at the top-right of the header row, OUTSIDE the header
   *  (e.g. a "more" button, a tag) — the same slot as `Expander`'s `actions`. */
  actions?: React.ReactNode
  /** Media (image, illustration) rendered full-bleed to the card edge, clipped to
   *  its corners. Position it with `mediaPosition`. */
  media?: React.ReactNode
  /** Which edge the `media` bleeds to.
   *  @defaultValue 'top' */
  mediaPosition?: "top" | "bottom" | "left" | "right"
  /** The card body. A string renders with the default `<Text>`-like typography;
   *  scopes the color hierarchy for any nested content. */
  children?: React.ReactNode
  /** Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for
   *  a one-off custom tone. Named tones re-point the surface + text; a custom
   *  color keeps its hue while lightness/chroma are pinned. `'neutral'` (the
   *  default) is the same as omitting it.
   *  @defaultValue 'neutral' */
  tone?:
    | "neutral"
    | "brand"
    | "info"
    | "success"
    | "warning"
    | "critical"
    | (string & {})
  /** Surface emphasis. `primary` (the default) is a clean sheet; `secondary` is a
   *  subtle fill; `tertiary` is a frosted, semi-transparent panel with a backdrop
   *  blur.
   *  @defaultValue 'primary' */
  priority?: "primary" | "secondary" | "tertiary"
  /** Size variant — scales the padding.
   *  @defaultValue 'medium' */
  size?: "small" | "medium" | "large"
  /** Selected / chosen state — draws an inset ring in the tone color, for
   *  choice-card / plan-picker patterns. */
  selected?: boolean
  /** Loading state — dims the card with a skeleton pulse, sets `aria-busy`, and (in
   *  link mode) blocks navigation. */
  loading?: boolean
  /** Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
   *  `number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit for
   *  the default `--card-radius`. */
  round?: boolean | number | string
  /** Turn the whole card into a link. The card renders a focusable anchor and its
   *  accessible name comes from `header` → body → this URL (override with
   *  `aria-label`). A link card is display content — don't nest interactive
   *  controls inside it. */
  href?: string
  /** Anchor target (only with `href`). */
  target?: string
  /** Anchor rel (only with `href`). */
  rel?: string
  /** Space-separated URLs the browser pings on navigation (only with `href`). */
  ping?: string
}

/**
 * A surface container: a bordered, toned box laying out an optional `media`
 * region plus a `header` / body / `footer` stack. Pass `href` to turn the whole
 * card into a link.
 *
 * Renders an `<a-card>` web component. A pure, stateless pass-through — the
 * element owns layout, the link, and the accessible name — so the wrapper only
 * maps props to attributes and projects content into the `media` / `header` /
 * `actions` / body / `footer` slots. Header / body / footer are respected as
 * passed; the element supplies their default typography.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * <Card header="Deployment ready" footer={<Button priority="primary" label="Deploy" />}>
 *   Your build passed all checks and is ready to ship.
 * </Card>
 * ```
 *
 * @example Link card
 * ```tsx
 * <Card href="/docs/ci" header="CI integration guide">
 *   Wire Antithesis into your pipeline in a few minutes.
 * </Card>
 * ```
 */
export const Card = ({
  header,
  footer,
  actions,
  media,
  mediaPosition,
  tone,
  priority,
  size,
  selected,
  loading,
  round,
  href,
  target,
  rel,
  ping,
  className,
  style,
  children,
  ...rest
}: CardProps) => {
  // Empty string is "no tone" — same as omitting it. A non-named tone is a literal
  // CSS color fed to the element's oklch derivation via the inline custom property.
  const toneAttr = tone || undefined
  const computedStyle = roundStyle(
    round,
    "--card-round",
    toneStyle(toneAttr, "--card-tone-source", style),
  )

  return (
    <a-card
      tone={toneAttr}
      // 'secondary' / 'medium' / 'top' are the implicit defaults — emit no attr.
      priority={priority && priority !== "primary" ? priority : undefined}
      size={size && size !== "medium" ? size : undefined}
      media-position={
        mediaPosition && mediaPosition !== "top" ? mediaPosition : undefined
      }
      // Boolean attrs: presence form (`''` on, omit off) — matched by presence in CSS.
      selected={selected ? "" : undefined}
      loading={loading ? "" : undefined}
      round={round ? "" : undefined}
      href={href}
      // Anchor extras only mean anything alongside href.
      target={href ? target : undefined}
      rel={href ? rel : undefined}
      ping={href ? ping : undefined}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {media != null && <div slot="media">{media}</div>}
      {header != null && <div slot="header">{header}</div>}
      {actions != null && (
        <span slot="actions" style={{ display: "contents" }}>
          {actions}
        </span>
      )}
      {children}
      {footer != null && (
        <span slot="footer" style={{ display: "contents" }}>
          {footer}
        </span>
      )}
    </a-card>
  )
}

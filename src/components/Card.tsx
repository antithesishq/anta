import type { BaseProps } from "../general_types"
import type { IconShape } from "../elements/a-icon.shapes"
import { toneStyle, roundStyle } from "../anta_helpers"
import { Title } from "./Title"
import { Text } from "./Text"
import { Icon } from "./Icon"

export interface CardProps extends BaseProps {
  /** Header content, in the top zone. A string is wrapped in a `<Title>` — a real
   *  heading in the document outline, tinted to match `tone`, at a level that
   *  tracks `size` (small → 5, medium → 4, large → 3). Pass your own node
   *  (`<Title level={2}>`, an `<h2>`) for a different level or styling. Omit for
   *  no header. */
  header?: React.ReactNode
  /** A secondary line under the header title, rendered as smaller text
   *  (`<Text size="small">`) in the heading section. Tinted to match `tone`, like
   *  the title. Omit for no subtitle. */
  subtitle?: React.ReactNode
  /** Leading visual for the header, laid out to the left of the `header` /
   *  `subtitle` as one aligned row (so it doesn't sit inline in the title, where it
   *  mis-aligns). A **string** is an icon shape, rendered as an `<Icon>` inside a
   *  circular chip (sized per the card via `--card-icon-size`); pass an `<img>`,
   *  initials (`<Text>`), or any node to use it as-is. Omit for none. */
  icon?: IconShape | (string & {}) | React.ReactNode
  /** Footer content, usually action buttons. Rendered as a **left-aligned** row
   *  (wraps under pressure) — the opposite of `Dialog`'s right-aligned footer. */
  footer?: React.ReactNode
  /** Media (image, illustration) rendered full-bleed to the card edge, clipped to
   *  its corners. Position it with `mediaPosition`. */
  media?: React.ReactNode
  /** Which edge the `media` bleeds to.
   *  @defaultValue 'top' */
  mediaPosition?: "top" | "bottom" | "left" | "right"
  /** The card body. A string is wrapped in a `<Text>` at secondary priority,
   *  following the card's `tone` and `size`; pass your own nodes to take over. */
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
 * Renders an `<a-card>` web component. A stateless projection — the element owns
 * layout, the link, and the accessible name, and stylizes only its own surface
 * (never its children's typography). The wrapper maps props to attributes,
 * projects content into the `media` / `icon` / `header` / body / `footer`
 * sections, and supplies typography for the two text zones by wrapping a string
 * `header` in `<Title>` and a string body in `<Text>`. A leading `icon` (a shape
 * string, or any node) is laid out beside the title / subtitle by the element.
 * There is no actions slot — lay out any header controls (buttons, tags) inside
 * the `header` yourself.
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
  subtitle,
  icon,
  footer,
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

  // The element stylizes only its own surface, never its children, so the wrapper
  // supplies the header/body typography by wrapping a string in <Title> / <Text>
  // and forwarding the card's `tone` to them so they tint to match. Title / Text
  // both take a custom CSS-colour tone (same oklch derivation as the card), so this
  // works for named *and* custom tones — passed straight through as `toneAttr`.

  // A string header becomes a <Title> whose level tracks the card size, so the
  // heading type scale matches the padding scale: small → 5, medium → 4, large → 3.
  const titleLevel = size === "small" ? 5 : size === "large" ? 3 : 4

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
      {icon != null &&
        // Leading visual for the header — carried in a slot div (like `media` /
        // `header`); the element lays it out beside the title / subtitle (see the
        // `icon` slot in a-card.ts).
        (typeof icon === "string" ? (
          // A shape string → the icon centered in a circular chip, sized per the
          // card via --card-icon-size (32 / 40 / 44 for small / medium / large).
          <div
            slot="icon"
            style={{
              width: "var(--card-icon-size, 40px)",
              height: "var(--card-icon-size, 40px)",
              borderRadius: "50%",
              background: "var(--bg-4)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon shape={icon as IconShape} />
          </div>
        ) : (
          // Any node → used as-is (no chip).
          <div slot="icon">{icon}</div>
        ))}
      {header != null &&
        (typeof header === "string" || typeof header === "number" ? (
          // A string header becomes a real <Title> at the size-mapped level (see
          // titleLevel). The header section's padding is the header→body gap; the
          // element zeroes the slotted title's own margins so it doesn't double it.
          // Pass a node (a `<Title level={n}>`, an `<h2>`) for a different level.
          <Title slot="header" level={titleLevel} tone={toneAttr}>
            {header}
          </Title>
        ) : (
          <div slot="header">{header}</div>
        ))}
      {subtitle != null && (
        // A subtitle sits in the header section too, right under the title, as
        // smaller text. Last header child, so its (absent) bottom margin leaves
        // the header→body gap to the section padding, like the title above it.
        <Text slot="header" size="small" priority="tertiary" tone={toneAttr}>
          {subtitle}
        </Text>
      )}
      {typeof children === "string" || typeof children === "number" ? (
        // A string / number body becomes a <Text> at secondary priority (text-2,
        // the body colour) — stated explicitly rather than leaning on the default —
        // following the card's tone and size. Anything else is a node the caller
        // owns, passed through untouched.
        <Text priority="secondary" tone={toneAttr} size={size}>
          {children}
        </Text>
      ) : (
        children
      )}
      {footer != null && (
        <span slot="footer" style={{ display: "contents" }}>
          {footer}
        </span>
      )}
    </a-card>
  )
}

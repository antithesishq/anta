import type { BaseProps } from "../general_types"
import type { IconShape } from "../elements/a-icon.shapes"
import { neutralToneAttr, toneStyle, roundStyle, roundAttr, hasChildren } from "../anta_helpers"
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
  /** Turn the whole card into a native link. ARIA props and `tabIndex` apply to
   *  that anchor. A text header or body supplies its default name; custom content
   *  uses the native content name. Override with `aria-label` or `aria-labelledby`.
   *  Linked cards must not contain interactive controls. */
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
 * Renders CSS-only `a-card-*` structural tags in light DOM. The wrapper owns
 * structure, link attributes, and ARIA. Raw HTML authors write the same markup.
 * Card needs no element registration; load its external CSS through the bundle
 * or the granular `@antadesign/anta/elements/a-card` entry.
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
 *   Connect your CI pipeline in a few minutes.
 * </Card>
 * ```
 */
export const Card = ({
  header, subtitle, icon, footer, media, mediaPosition, tone, priority, size,
  selected, loading, round, href, target, rel, ping, className, style, children,
  tabIndex, ...rest
}: CardProps) => {
  const toneAttr = neutralToneAttr(tone)
  const computedStyle = roundStyle(round, "--card-round", toneStyle(toneAttr, "--card-tone-source", style))
  const titleLevel = size === "small" ? 5 : size === "large" ? 3 : 4
  const linked = href != null
  const aria: Record<string, unknown> = {}
  const host: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(rest)) {
    if (name.startsWith("aria-")) aria[name] = value
    else host[name] = value
  }
  const textValue = (node: React.ReactNode) =>
    typeof node === "string" || typeof node === "number" ? String(node).replace(/\s+/g, " ").trim() || undefined : undefined
  const textName = textValue(header) ?? textValue(children)
  const present = (node: React.ReactNode) => typeof node !== "boolean" && hasChildren(node)
  const busy = aria["aria-busy"] as React.AriaAttributes["aria-busy"]
  const label = aria["aria-label"] as string | undefined
  const content = (
    <>
      {present(media) && <a-card-media>{media}</a-card-media>}
      <a-card-content>
        {(present(header) || present(subtitle) || present(icon)) && (
          <a-card-header>
            {present(icon) && (
              <a-card-icon>
                {typeof icon === "string" ? (
                  <a-card-icon-chip><Icon shape={icon as IconShape} /></a-card-icon-chip>
                ) : icon}
              </a-card-icon>
            )}
            {(present(header) || present(subtitle)) && (
              <a-card-title>
                {typeof header === "string" || typeof header === "number" ? (
                  <Title level={titleLevel} tone={toneAttr} font="sans-serif">{header}</Title>
                ) : header}
                {present(subtitle) && (
                  <Text size="small" priority="tertiary" tone={toneAttr}>{subtitle}</Text>
                )}
              </a-card-title>
            )}
          </a-card-header>
        )}
        {present(children) && (
          <a-card-body>
            {typeof children === "string" || typeof children === "number" ? (
              <Text priority="secondary" tone={toneAttr} size={size}>{children}</Text>
            ) : children}
          </a-card-body>
        )}
        {present(footer) && <a-card-footer>{footer}</a-card-footer>}
      </a-card-content>
    </>
  )
  return (
    <a-card
      tone={toneAttr}
      priority={priority && priority !== "primary" ? priority : undefined}
      size={size && size !== "medium" ? size : undefined}
      media-position={mediaPosition && mediaPosition !== "top" ? mediaPosition : undefined}
      selected={selected ? "" : undefined}
      loading={loading ? "" : undefined}
      round={roundAttr(round)}
      class={className}
      style={computedStyle}
      tabIndex={linked ? undefined : tabIndex}
      {...host}
      {...(linked ? {} : aria)}
      aria-busy={linked ? undefined : busy ?? (loading ? "true" : undefined)}
    >
      {linked ? (
        <a
          href={loading ? undefined : href}
          target={loading ? undefined : target}
          rel={loading ? undefined : rel}
          ping={loading ? undefined : ping}
          tabIndex={tabIndex}
          {...aria}
          aria-label={label ?? (loading ? undefined : textName)}
          aria-busy={busy ?? (loading ? "true" : undefined)}
        >{content}</a>
      ) : content}
    </a-card>
  )
}

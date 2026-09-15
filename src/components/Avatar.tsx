import type { BaseProps } from "../general_types"
import type { AvatarGenConfig } from "../avatar-core"
import { lengthStyle, roundStyle, roundAttr, toneStyle } from "../anta_helpers"

// `children` is omitted: the element has no slot, so anything passed would land
// in its light DOM and never render (mirrors RadioGroup omitting it).
export interface AvatarProps extends Omit<BaseProps, 'children'> {
  /** Alphanumeric seed that deterministically drives the generated userpic. The
   *  same seed always renders the same avatar. Falls back to `name` when omitted,
   *  so a stable user id or name is a good value. */
  seed?: string
  /** Person or entity name. Supplies the initials fallback (up to 3 letters from
   *  the first 3 words) and the accessible name, and seeds generation when `seed`
   *  is absent. */
  name?: string
  /** Image URL. When set, the image is shown instead of a generated userpic,
   *  cropped to fill the container. */
  src?: string
  /** Size of the square container. A number is a pixel size.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large' | number
  /** Corner badge, colored by tone. Pass a named tone or any literal CSS color;
   *  the application decides what each tone means (`success` for online,
   *  `critical` for busy, `neutral` for offline). Omit for no badge. */
  badge?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Fully-round (circular) frame. Pass a `number` (px) or a CSS length string
   *  for a custom radius instead. */
  round?: boolean | number | string
  /** Brand generation constraints — each dimension is OFF / ANY / RANGE / LIST.
   *  Colors cap OKLCH ranges or pass an explicit palette. Omit for the default
   *  varied figure. Define one config for the app and reuse it across avatars. */
  generator?: AvatarGenConfig
}

/**
 * Avatar — a userpic container. Shows a supplied image, a seed-generated
 * placeholder figure, or initials, in that priority order.
 *
 * Renders an `<a-avatar>` web component. Generation runs in `avatar-core`; pass a
 * `generator` config to cap the space to your brand (see the color and dimension
 * options on `AvatarGenConfig`). With no `generator`, a varied figure is drawn;
 * a config whose head and body shapes are both `off` renders initials instead.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom element.
 *
 * @example Generated userpic
 * ```tsx
 * import { Avatar } from '@antadesign/anta'
 * import '@antadesign/anta/elements'
 *
 * <Avatar seed="user-42" name="Vlad Korobov" />
 * ```
 *
 * @example Image with a badge
 * ```tsx
 * <Avatar src="/vlad.jpg" name="Vlad Korobov" badge="success" />
 * ```
 *
 * @example Initials (no figure shape configured)
 * ```tsx
 * <Avatar
 *   name="Vlad Korobov"
 *   generator={{ headRadiusTop: { mode: 'off' }, headRadiusBottom: { mode: 'off' }, bodyBorderRadius: { mode: 'off' } }}
 * />
 * ```
 */
export const Avatar = ({ seed, name, src, size, badge, round, generator, className, style, ...rest }: AvatarProps) => {
  const numericSize = typeof size === 'number'
  // A numeric size feeds the pixel value through `--avatar-size` (computed key
  // via the shared helper — a literal `--avatar-size` key trips the excess-
  // property check on React.CSSProperties).
  // A custom (non-named) badge color reaches the element's oklch derivation
  // through the inline tone-source property (shared helper — see anta_helpers).
  const sized = numericSize ? lengthStyle(size, '--avatar-size', style) : style
  const rounded = roundStyle(round, '--avatar-radius', sized)
  const mergedStyle = toneStyle(badge, '--avatar-badge-tone-source', rounded)
  return (
    <a-avatar
      seed={seed}
      name={name}
      src={src}
      // 'medium' (and unset) is the implicit default — emit no DOM attribute.
      size={!numericSize && size && size !== 'medium' ? size : undefined}
      badge={badge}
      round={roundAttr(round)}
      // Serialize the config to the JSON `config` attribute — the element parses
      // it, so generation is declarative (works in SSR and hand-authored markup).
      config={generator ? JSON.stringify(generator) : undefined}
      // `role="img"` needs an accessible name to be valid, and `name` is what
      // supplies it. Without a name the avatar carries no information a screen
      // reader needs, so it stays decorative rather than an unnamed image.
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : 'true'}
      class={className}
      style={mergedStyle}
      {...rest}
    />
  )
}

import type { StickerA11y, StickerProps } from "./Sticker";

/** Public props for animated stickers. The static `Sticker` variant does not
 *  accept playback props. */
export interface StickerAnimatedProps extends StickerProps {
  /** `true` freezes the animation at the current frame; a number freezes
   *  at that time in seconds; omit (or `false`) to play. */
  paused?: boolean | number
  /** Seconds to wait at the first frame before playing. */
  delay?: number
  /** Play once and hold the final frame instead of looping. */
  playOnce?: boolean
  /** With `playOnce`, restart the animation when the sticker is activated. */
  replayOnClick?: boolean
}

/** Internal — the bound Lottie animation is supplied by the generated
 *  per-sticker module as a JSON string. The element parses it once on
 *  attribute set. */
interface StickerAnimatedInternalProps extends StickerAnimatedProps {
  animation: string;
}

/**
 * Internal renderer for animated stickers. Generated
 * `Sticker{Name}Animated` exports under `@antadesign/stickers`
 * call this with their bound Lottie JSON string. The
 * `<a-sticker-animated>` element receives it as an attribute, parses
 * it once, and drives a shadow-DOM `<svg>` via `lottie-web`.
 */
export const StickerAnimated = ({
  animation,
  size,
  paused,
  delay,
  playOnce,
  replayOnClick,
  label,
  ...rest
}: StickerAnimatedInternalProps) => {
  const a11y: StickerA11y | { role: 'button'; 'aria-label': string; tabIndex: number } =
    replayOnClick
      ? { role: 'button', 'aria-label': label ?? 'Replay animation', tabIndex: 0 }
      : label != null
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": "true" };
  // `paused` semantics:
  //   undefined / false → omit attribute (plays)
  //   true              → empty string (freeze at current frame)
  //   number            → that value as string (seconds; freeze at time)
  const pausedAttr =
    paused === true
      ? ""
      : typeof paused === "number"
        ? String(paused)
        : undefined
  const delayAttr = typeof delay === 'number' && delay > 0 ? String(delay) : undefined
  const style =
    size != null
      ? ({
          ...rest.style,
          ["--sticker-size" as string]: `${size}px`,
        } as React.CSSProperties)
      : rest.style;
  return (
    <a-sticker-animated
      animation={animation}
      paused={pausedAttr}
      delay={delayAttr}
      play-once={playOnce ? '' : undefined}
      replay-on-click={replayOnClick ? '' : undefined}
      {...a11y}
      {...rest}
      style={style}
    />
  );
};

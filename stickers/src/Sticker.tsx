import type { BaseProps } from "@antadesign/anta/general_types";

/** Base public props for stickers — shared by both static and animated.
 *  Inherits `className` and `style` from `BaseProps`. The animated
 *  variant (`StickerAnimated`) extends this with `paused`. */
export interface StickerProps extends Omit<BaseProps, "children"> {
  /** Edge length in pixels. Stickers are always square. Defaults to 256. */
  size?: number;
  label?: string;
}

/** ARIA attribute shape applied to sticker hosts — either meaningful
 *  (`role="img"` + `aria-label`) or decorative (`aria-hidden="true"`). */
export type StickerA11y = {
  role?: string;
  "aria-label"?: string;
  "aria-hidden"?: "true";
};

/** Internal — supplied by the generated per-sticker module; the bound
 *  SVG markup is the per-sticker payload. */
interface StickerInternalProps extends StickerProps {
  svg: string;
}

/**
 * Internal renderer for static stickers. Generated `Sticker{Name}`
 * exports under `@antadesign/stickers` call this with their bound
 * inline SVG markup. The `<a-sticker>` element renders the SVG into
 * its shadow DOM; sizing is composed into the host's inline `style` as
 * `--sticker-size` (the element doesn't mutate its own host — see the
 * declarative-DOM rule in ../src/AGENTS.md).
 */
export const Sticker = ({
  svg,
  size,
  label,
  ...rest
}: StickerInternalProps) => {
  const a11y: StickerA11y =
    label != null
      ? { role: "img", "aria-label": label }
      : { "aria-hidden": "true" };
  const style =
    size != null
      ? ({
          ...rest.style,
          ["--sticker-size" as string]: `${size}px`,
        } as React.CSSProperties)
      : rest.style;
  return <a-sticker svg={svg} {...a11y} {...rest} style={style} />;
};

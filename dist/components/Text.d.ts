import type { BaseProps } from "../general_types";
export interface TextProps extends BaseProps {
    /** Visual priority. Maps to text-1..text-5. Defaults to 'primary' (text-1). */
    priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary';
    /** Color tint. Applies the matching `--text-{N}-{tone}` palette. */
    tone?: 'brand' | 'success' | 'critical' | 'warning' | 'info';
    /** Render as inline-block instead of the default block element. */
    inline?: boolean;
    /** Truncate with a trailing ellipsis. `true` (or `1`) clamps to a
     *  single line; any integer ≥ 2 clamps to that many lines. Uses the
     *  `-webkit-line-clamp` technique, supported in all major browsers
     *  (Firefox 68+, Chrome, Safari, Edge). */
    truncate?: boolean | number;
    /** Show a fade hint and chevron over the truncated text and let the
     *  user expand it by clicking the chevron region or pressing Enter
     *  while the chevron has keyboard focus. Only takes effect together
     *  with `truncate`. */
    expandable?: boolean;
}
/**
 * Block-level text container with priority and tone support.
 *
 * Renders an `<a-text>` web component that scopes its descendants'
 * color hierarchy. Links nested inside follow the design system's
 * priority-aware link styling. Pass `inline` for an inline-block
 * variant, `truncate` for ellipsis truncation, and `expandable`
 * (combined with `truncate`) to let the user reveal the full text.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * <Text priority="secondary">Secondary emphasis</Text>
 * ```
 *
 * @example Expandable truncated text
 * ```tsx
 * <Text truncate={3} expandable>…long paragraph…</Text>
 * ```
 */
export declare const Text: ({ priority, tone, inline, truncate, expandable, className, style, children, ...rest }: TextProps) => any;

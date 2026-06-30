import type { BaseProps } from "../general_types"

export interface TooltipProps extends BaseProps {
  /** Tooltip content. Renders anything — text, markup, an icon + text.
   *  Lives in the light DOM, so it's styleable with your own plain CSS. */
  children?: React.ReactNode
  /** Show delay in milliseconds after hover / focus. Never use `0` — use
   *  ~`50` for a near-instant tooltip (0 has caused issues in practice).
   *  @defaultValue 250 */
  delay?: number
  /** Which side of the anchor the bubble prefers. Auto-flips to the other
   *  side when there isn't room.
   *  @defaultValue bottom */
  placement?: 'top' | 'bottom'
  /** Follow the cursor instead of pinning under the anchor. The bubble is
   *  pinned (anchored beneath the target) by default; pass `follow` for the
   *  cursor-tracking behaviour, which fades by distance as the cursor leaves. */
  follow?: boolean
  /** Make the bubble hoverable and clickable — enables pointer events and
   *  keeps it open while the cursor is over it, so its content (links,
   *  buttons) can be interacted with. Always pinned (an interactive bubble
   *  can't follow the cursor, even with `follow`). */
  interactive?: boolean
  /** Only show when the target is actually truncated (its text overflows and is
   *  ellipsized); a label that fits gets no tooltip. The check is a UI-thread
   *  layout read, re-measured on each show. By default it measures the nearest
   *  Anta ellipsizing label part (`<a-tab-label>` / `<a-button-label>`) inside
   *  the anchor, then the anchor itself — override with `truncatedSelector`. */
  truncatedOnly?: boolean
  /** CSS selector (resolved within the anchor) for the element whose overflow
   *  decides whether a `truncatedOnly` tooltip shows. */
  truncatedSelector?: string
}

/**
 * Tooltip — a small floating bubble that describes the element it's placed
 * inside. Render `<Tooltip>` as a child of the element it annotates; it
 * doesn't affect that element's layout.
 *
 * Shows on hover (after `delay`) and on keyboard focus; dismisses on mouse
 * leave, blur, Escape, or when the anchor scrolls away. On touch devices it
 * opens on press-and-hold (a tap never surfaces it) and lingers briefly after
 * release. Pinned under the anchor by default — pass `follow` to make it track
 * the cursor instead.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * import { Tooltip } from '@antadesign/anta'
 * import '@antadesign/anta/elements'
 *
 * <button>
 *   Save
 *   <Tooltip>Saves your work</Tooltip>
 * </button>
 * ```
 *
 * @example Above the anchor, rich content
 * ```tsx
 * <span style={{ cursor: 'help' }}>
 *   Status
 *   <Tooltip placement="top">
 *     <strong>Healthy</strong> — last checked 2m ago
 *   </Tooltip>
 * </span>
 * ```
 *
 * @example Follow the cursor
 * ```tsx
 * <button>
 *   Hover me
 *   <Tooltip follow>Tracks the pointer</Tooltip>
 * </button>
 * ```
 */
export const Tooltip = ({
  delay,
  placement,
  follow,
  interactive,
  truncatedOnly,
  truncatedSelector,
  className,
  children,
  ...rest
}: TooltipProps) => {
  return (
    <a-tooltip
      delay={delay != null ? String(delay) : undefined}
      // 'bottom' is the implicit default — emit no DOM attribute for it.
      placement={placement === 'top' ? 'top' : undefined}
      // Boolean attributes: presence form when on, omitted when off.
      follow={follow ? '' : undefined}
      interactive={interactive ? '' : undefined}
      truncated-only={truncatedOnly ? '' : undefined}
      truncated-selector={truncatedSelector || undefined}
      class={className}
      {...rest}
    >
      {children}
    </a-tooltip>
  )
}

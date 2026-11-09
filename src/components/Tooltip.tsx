import type { BaseProps, DOMEventHandlers } from "../general_types"
import { roundStyle, roundAttr } from "../anta_helpers"

export interface TooltipProps extends BaseProps, DOMEventHandlers {
  /** Supplementary text or markup. Content stays in light DOM for application CSS. */
  children?: React.ReactNode
  /** Wait in milliseconds after hover or keyboard focus. Use `50` for a short delay.
   *  @defaultValue 300 */
  delay?: number
  /** Which side of the anchor the bubble prefers. Auto-flips to the other
   *  side when there isn't room.
   *  @defaultValue bottom */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Round the bubble to a 20px radius (matching a round menu). Pass a `number`
   *  (px) or a CSS length string for a custom radius. */
  round?: boolean | number | string
  /** Follow the cursor instead of pinning under the anchor. The bubble is
   *  pinned (anchored beneath the target) by default; pass `follow` for the
   *  cursor-tracking behavior, which fades by distance as the cursor leaves. */
  follow?: boolean
  /** Keep content available while the pointer or keyboard focus is inside it.
   *  Enables pointer events and pins the bubble even with `follow`. Essential
   *  actions belong in a Menu or Dialog with an explicit trigger. */
  interactive?: boolean
  /** Contain bubbling pointer, mouse, touch, click, context-menu, and wheel
   *  handlers. `true` contains JSX events while preserving Tooltip and child callbacks.
   *  `'native'` stops propagation at the web component, including to native
   *  parents, but blocks delegated React handlers on the Tooltip and its children,
   *  including `onClick`, `onPointerDown`, and `onWheel`. Use `true` when those
   *  callbacks are needed. Native listeners inside the boundary still run. Both enable
   *  interactive behavior and preserve browser defaults, keyboard, and focus.
   *  Capture respects both modes. Custom native parents must check
   *  `isContainedEvent` with `true`; ancestor capture handlers must check it
   *  in either mode because they run before the Tooltip. */
  containEvents?: boolean | 'native'
  /** Only show when the target is actually truncated (its text overflows and is
   *  ellipsized); a label that fits gets no tooltip. The check is a UI-thread
   *  layout read, re-measured on each show. By default it measures every Anta
   *  ellipsizing label part inside the anchor, then the anchor itself —
   *  override with `truncatedSelector`. */
  truncatedOnly?: boolean
  /** CSS selector (resolved within the anchor) for the element or elements
   *  whose overflow decides whether a `truncatedOnly` tooltip shows. */
  truncatedSelector?: string
}

const CONTAINED_HANDLERS = [
  'onPointerDown', 'onPointerUp', 'onPointerMove', 'onPointerCancel', 'onPointerOver', 'onPointerOut',
  'onGotPointerCapture', 'onLostPointerCapture',
  'onMouseDown', 'onMouseUp', 'onMouseMove', 'onMouseOver', 'onMouseOut',
  'onClick', 'onDoubleClick', 'onAuxClick', 'onContextMenu',
  'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel', 'onWheel',
] as const

function stopPropagation(event: { stopPropagation(): void }) {
  event.stopPropagation()
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
 * import { Tooltip, Button } from '@antadesign/anta'
 * import '@antadesign/anta/elements'
 *
 * <Button label="Save">
 *   <Tooltip>Saves your work</Tooltip>
 * </Button>
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
 * <Button label="Hover me">
 *   <Tooltip follow>Tracks the pointer</Tooltip>
 * </Button>
 * ```
 */
export const Tooltip = ({
  delay,
  placement,
  round,
  follow,
  interactive,
  containEvents,
  truncatedOnly,
  truncatedSelector,
  className,
  style,
  children,
  ...rest
}: TooltipProps) => {
  const events: DOMEventHandlers = {}
  if (containEvents && containEvents !== 'native') {
    for (const name of CONTAINED_HANDLERS) {
      const handler = rest[name]
      events[name] = handler ? event => {
        try { handler(event) } finally { event.stopPropagation() }
      } : stopPropagation
    }
  }
  return (
    <a-tooltip
      delay={delay != null ? String(delay) : undefined}
      // 'bottom' is the implicit default — emit no DOM attribute for it.
      placement={placement === 'top' || placement === 'left' || placement === 'right' ? placement : undefined}
      // Boolean attributes: presence form when on, omitted when off.
      round={roundAttr(round)}
      follow={follow ? '' : undefined}
      interactive={interactive ? '' : undefined}
      contain-events={containEvents === 'native' ? 'native' : containEvents ? '' : undefined}
      truncated-only={truncatedOnly ? '' : undefined}
      truncated-selector={truncatedSelector || undefined}
      class={className}
      style={roundStyle(round, '--tooltip-round', style)}
      {...rest}
      {...events}
    >
      {children}
    </a-tooltip>
  )
}

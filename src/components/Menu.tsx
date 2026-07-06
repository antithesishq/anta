import { nativeStateChange, roundStyle } from '../anta_helpers'
import type { BaseProps } from '../general_types'

export interface MenuProps extends BaseProps {
  /** Preferred placement relative to the trigger. The cross-axis suffix
   *  (`-start` / `-end`) aligns the left / right edges; no suffix (`bottom` /
   *  `top`) centers the menu on the trigger. The menu auto-flips vertically and
   *  clamps horizontally when there isn't room.
   *  @defaultValue bottom-start */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'bottom' | 'top'
  /** Open on right-click (the `contextmenu` event) of the trigger region
   *  instead of a left click, positioned at the pointer. */
  context?: boolean
  /** Open at the pointer coordinates rather than aligned to the trigger box.
   *  Pairs naturally with `context`; on its own it positions a left-click
   *  menu at the cursor. */
  coord?: boolean
  /** Submenu-only (a `<Menu>` nested inside a `MenuItem`); ignored on a root
   *  menu. Submenus open on hover by default (with intent timing) as well as on
   *  click — set `nohover` to make this submenu click-only. Hover-intent is
   *  mouse-only regardless: on touch (and pen) a submenu always opens on tap and
   *  stays open until dismissed. */
  nohover?: boolean
  /** Gap in pixels between the trigger and the menu.
   *  @defaultValue 4 */
  offset?: number
  /** Controlled open state. Omit for the default **uncontrolled** menu (it
   *  opens/closes itself via its triggers). Pass a boolean to **control** it:
   *  the menu's visibility follows `open`, and user dismiss (Esc, outside-click,
   *  select) fires `onStateChange` *without* self-closing — you update `open`
   *  in response. Submenus are always uncontrolled regardless of this. See
   *  STATEFUL-COMPONENTS.md. */
  open?: boolean
  /** Round the menu: the container softens to a 20px radius and its items go
   *  fully round. A `number` (px) or CSS length string tunes the container radius
   *  only — items stay full pills. */
  round?: boolean | number | string
  /** Fired before the open state changes — on open, and on every dismiss (Esc,
   *  outside-click, scroll, selecting an item). `event` is the cancelable
   *  `statechange`; `detail.next`/`detail.prev` are the requested/previous open
   *  state (booleans). It's the declarative way to observe a menu, and the
   *  handler you pair with `open` to drive a controlled menu (apply
   *  `detail.next` to `open`). Uncontrolled, `event.preventDefault()` vetoes the
   *  transition (e.g. keep the menu open). */
  onStateChange?: (
    event: CustomEvent,
    detail: { next: boolean; prev: boolean },
  ) => void
  /** The menu's contents: `MenuItem`, `MenuSeparator`, `MenuGroup`, or any
   *  custom element. */
  children?: React.ReactNode
}

/** The element's `statechange` payload, in the `'open'|'closed'` vocabulary. */
type StateChangeDetail = { next: 'open' | 'closed'; prev: 'open' | 'closed' }
type StateChangeEvent =
  | CustomEvent<StateChangeDetail>
  | { nativeEvent: CustomEvent<StateChangeDetail> }


/**
 * Menu — a dropdown / context menu that anchors to any target and "just
 * works". Place `<Menu>` immediately after the trigger element (a button,
 * say); it opens on click by default. For a whole-area right-click menu, put
 * it after the region and pass `context`.
 *
 * Open state is uncontrolled by default — listen for `onStateChange`
 * (`detail: { next, prev }`) to observe it, or pass `open` to control it. You
 * can also grab a `ref` and call `.open()` / `.close()` / `.toggle()`.
 * Selecting a `MenuItem` closes the menu;
 * arbitrary injected content does not. Add `data-menu-open` to any item /
 * container to keep it open, or `data-menu-close` to a custom element to let it
 * close.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only).
 *
 * @example Dropdown from a button
 * ```tsx
 * <a-button>Actions</a-button>
 * <Menu>
 *   <MenuItem icon="edit" label="Edit" kbd="⌘E" onSelect={onEdit} />
 *   <MenuSeparator />
 *   <MenuItem tone="critical" icon="trash" label="Delete" onSelect={onDelete} />
 * </Menu>
 * ```
 */
export const Menu = ({
  placement,
  context,
  coord,
  nohover,
  offset,
  open,
  onStateChange,
  round,
  className,
  style,
  children,
  ...rest
}: MenuProps) => {
  return (
    <a-menu
      // 'bottom-start' is the implicit default — emit no DOM attribute.
      placement={placement && placement !== 'bottom-start' ? placement : undefined}
      context={context ? '' : undefined}
      coord={coord ? '' : undefined}
      nohover={nohover ? '' : undefined}
      offset={offset != null ? String(offset) : undefined}
      // Controlled lever — boolean prop → 'open'/'closed' enum; omit ⇒ uncontrolled.
      state={open === undefined ? undefined : open ? 'open' : 'closed'}
      // All-lowercase `onstatechange` is the one event-prop spelling both React
      // and Preact bind to a custom element's custom event (they lowercase
      // whatever follows `on`, so `onStateChange` would listen for "StateChange").
      onstatechange={
        onStateChange
          ? (e: StateChangeEvent) => {
              const { event, detail } = nativeStateChange<StateChangeDetail>(e)
              if (detail)
                onStateChange(event, {
                  next: detail.next === 'open',
                  prev: detail.prev === 'open',
                })
            }
          : undefined
      }
      round={round ? '' : undefined}
      role="menu"
      aria-orientation="vertical"
      class={className}
      style={roundStyle(round, '--menu-round', style)}
      {...rest}
    >
      {children}
    </a-menu>
  )
}

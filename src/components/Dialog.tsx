import { nativeStateChange, roundStyle } from "../anta_helpers";
import type { BaseProps } from "../general_types";
import { Button } from "./Button";

/** The `round` side keywords, which select corners rather than set an amount. */
const ROUND_SIDES = new Set(["top", "right", "bottom", "left"]);

/** Public props for the `<Dialog>` modal / drawer. `header` and `footer` are the
 *  chrome zones; `children` is the (scrollable) body. */
export interface DialogProps extends Omit<BaseProps, "title"> {
  /** Header content: a title, or any node. Rendered in the top zone. Omit for a
   *  chromeless dialog with only a body. */
  header?: React.ReactNode;
  /** Footer content, usually the action buttons. Rendered in the bottom zone as
   *  a right-aligned row (wraps under pressure). Omit for none. */
  footer?: React.ReactNode;
  /** The dialog body. Scrolls when it overflows the available height. */
  children?: React.ReactNode;
  /** Placement. `center` (the default) is a centered modal; `left` / `right` /
   *  `top` / `bottom` turn it into an edge drawer (full height for left/right,
   *  full width for top/bottom); `fullscreen` fills the whole viewport with no
   *  edge gap or corner radius.
   *  @defaultValue 'center' */
  position?: "center" | "left" | "right" | "top" | "bottom" | "fullscreen";
  /** Whether the top-right ✕ button is present. It's one way to close the dialog,
   *  alongside Esc, the backdrop, a `data-dialog-close` / footer action, and your
   *  own code; `false` just removes the ✕, it doesn't make the dialog un-closable.
   *  @defaultValue true */
  closable?: boolean;
  /** Turn off light-dismiss: a backdrop click and Esc no longer close the dialog.
   *  It stays closable through explicit controls (the ✕ when `closable`, a footer
   *  action, your own code); `persistent` isn't "un-closable", it stops an
   *  accidental click or stray Esc from dismissing. For an alert / confirm that
   *  should be answered deliberately. Omit for the default dismissible behavior. */
  persistent?: boolean;
  /** Corner radius. A side keyword — `'top'` / `'right'` / `'bottom'` / `'left'` —
   *  rounds only that edge's two corners (at `--dialog-radius`), which pairs with
   *  a drawer's exposed edge (a bottom sheet → `'top'`, a right drawer → `'left'`).
   *  A `number` (px) or CSS string rounds all corners at that value; the string
   *  may be a full `border-radius` shorthand (`'12px 12px 0 0'`). `true` rounds all
   *  corners at `--dialog-radius`. Omit for the position default: `center` is
   *  rounded, drawers and `fullscreen` are square. */
  round?: boolean | number | "top" | "right" | "bottom" | "left" | (string & {});
  /** Controlled open state. When provided, the consumer owns open/close: the
   *  dialog only follows this prop, and every user dismiss (Esc, backdrop, close
   *  button) *requests* a change via `onStateChange` (reject by not updating).
   *  Leave undefined for uncontrolled. */
  open?: boolean;
  /** Initial open state for the uncontrolled case (read once on mount). */
  defaultOpen?: boolean;
  /** Uncontrolled trigger name. Any element with `data-dialog-open="{name}"`
   *  opens this dialog, `data-dialog-close="{name}"` closes it. A convenience for
   *  triggers rendered elsewhere; ignored in controlled mode. */
  name?: string;
  /** Fired before the open state changes, on every user open or dismiss.
   *  `event` is the cancelable `statechange`: call `event.preventDefault()` to
   *  veto an *uncontrolled* transition. `detail.next` is the requested open
   *  state, `detail.prev` the current one (booleans). In controlled mode, apply
   *  `detail.next` to `open` to accept, or do nothing to reject. */
  onStateChange?: (
    event: CustomEvent,
    detail: { next: boolean; prev: boolean },
  ) => void;
}

/** The element's `statechange` payload, in the `'open'|'closed'` vocabulary. */
type StateChangeDetail = { next: "open" | "closed"; prev: "open" | "closed" };
type StateChangeEvent =
  | CustomEvent<StateChangeDetail>
  | { nativeEvent: CustomEvent<StateChangeDetail> };

/**
 * `<Dialog>` — a modal dialog (or edge drawer, via `position`), built on a
 * native `<dialog>` inside `<a-dialog>` — so the top layer, focus trap, focus
 * return, backdrop, and Esc all come from the platform.
 *
 * A pure, stateless pass-through: the element owns all interaction (open/close,
 * dismiss, focus), so the wrapper holds no state and grabs no ref — it only maps
 * props to attributes and drops content into the `header` / body / `footer` /
 * `close` slots.
 *
 * Uncontrolled (`defaultOpen`, or the `name` trigger convenience): the element
 * owns open/close. Controlled (`open` + `onStateChange`): the wrapper emits
 * `state="open"|"closed"`; the element treats the attribute as the source of
 * truth, and every user dismiss only *requests* a change (a consumer can reject
 * it). See STATEFUL-COMPONENTS.md.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom element.
 *
 * @example Controlled
 * ```tsx
 * const [open, setOpen] = useState(false)
 * <Button onClick={() => setOpen(true)}>Open</Button>
 * <Dialog
 *   open={open}
 *   onStateChange={(_e, { next }) => setOpen(next)}
 *   header="Delete project?"
 *   footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button priority="primary" tone="critical">Delete</Button></>}
 * >
 *   This action cannot be undone.
 * </Dialog>
 * ```
 */
export const Dialog = ({
  header,
  footer,
  position,
  closable,
  persistent,
  round,
  open,
  defaultOpen,
  name,
  onStateChange,
  className,
  style,
  children,
  ...rest
}: DialogProps) => {
  const controlled = open !== undefined;

  // A side keyword selects corners (passed through as the attribute value); any
  // other truthy `round` sets the amount via the `--dialog-round` var (the shared
  // roundStyle path) and emits the bare presence flag.
  const roundSide =
    typeof round === "string" && ROUND_SIDES.has(round) ? round : undefined;

  return (
    <a-dialog
      state={controlled ? (open ? "open" : "closed") : undefined}
      default-state={!controlled && defaultOpen ? "open" : undefined}
      // 'center' is the implicit default — emit no DOM attribute for it.
      position={position && position !== "center" ? position : undefined}
      // Positive opt-in (default off): emit the presence flag only when set.
      persistent={persistent ? "" : undefined}
      round={roundSide ?? (round ? "" : undefined)}
      name={!controlled ? name : undefined}
      // All-lowercase `onstatechange` is the one spelling both renderers bind to
      // the element's `statechange` event (React 19 keeps the case after `on`, so
      // `onStateChange` would listen for "StateChange"; Preact lowercases).
      onstatechange={
        onStateChange
          ? (e: StateChangeEvent) => {
              const { event, detail, isOwn } = nativeStateChange<StateChangeDetail>(e);
              // Ignore a `statechange` bubbled up from a control inside the dialog
              // (a Checkbox, a consumer's own element): its detail speaks a different
              // vocabulary and would read as a spurious close. Only the dialog's own
              // open/closed request counts. See nativeStateChange / STATEFUL-COMPONENTS.md.
              if (isOwn && detail)
                onStateChange(event, {
                  next: detail.next === "open",
                  prev: detail.prev === "open",
                });
            }
          : undefined
      }
      class={className}
      // A side keyword sets no amount; anything else feeds --dialog-round (a
      // number → px, a string verbatim, so a shorthand like "12px 12px 0 0" works).
      style={roundStyle(roundSide ? undefined : round, "--dialog-round", style)}
      {...rest}
    >
      {closable !== false && (
        // A real <a-button> (light DOM → fully styled, keyboard-focusable) in the
        // element's `close` slot. It fires the bubbling `closerequest` event via
        // a-button's global listener, so closing works even without framework
        // hydration; the element turns that into a close request.
        // CONTRACT: `data-custom-event` below MUST match `CLOSE_TRIGGER` in the
        // element (src/elements/a-dialog.ts). Duplicated, not shared — importing
        // the element module here would self-register it and break the
        // wrapper/element decoupling. Rename in both places.
        <span slot="close" style={{ display: "contents" }}>
          <Button
            priority="tertiary"
            size="large"
            icon="x"
            aria-label="Close"
            data-custom-event="closerequest"
          />
        </span>
      )}
      {header != null && <div slot="header">{header}</div>}
      {children}
      {footer != null && (
        <span slot="footer" style={{ display: "contents" }}>
          {footer}
        </span>
      )}
    </a-dialog>
  );
};

import { HTMLElementBase } from "../anta_helpers";
import { emitCopyRequest, runCopy } from "./copy-behavior";
import "./a-copy.css";

declare global {
  interface Document {
    hasCopyDelegation?: boolean;
  }
}

/**
 * `<a-copy>` — the copy-to-clipboard behavior, as a composable child.
 *
 * Slot it inside an activatable control (`<a-button>`, `<a-menu-item>`, or a
 * native `button` / `[role]`) and it turns that control into a copy control:
 * on activation it writes to the clipboard and reports the outcome via a
 * `copydone` event; on `toast` it also floats a ghost of the host's visible label
 * upward as visual feedback. The base controls carry NO copy knowledge — this
 * element owns the whole feature, so `<Button>` / `<MenuItem>` stay clean and
 * `<ButtonCopy>` / `<MenuItemCopy>` are thin composers that drop it in.
 *
 * ## How it observes activation (delegation, not per-instance listeners)
 *
 * Attaching a listener to every host would mean one listener per (possibly
 * offscreen) copy control — the cost `<a-button>` avoids with a single delegated
 * handler per document. `<a-copy>` does the same: `installCopyDelegation` wires
 * exactly one `pointerdown` / `keydown` / `click` / `menuselect` handler per
 * document (guarded by a flag), and each resolves the activated host from the
 * event, then the host's own `<a-copy>` child. `menuselect` is dispatched
 * `bubbles: false`, but a **capture-phase** document listener still sees it (the
 * capture phase runs root→target regardless of bubbling), so menu rows need no
 * special path.
 *
 * - `pointerdown` / `keydown` (Enter/Space) → `emitCopyRequest` (the lazy
 *   pre-request; the pointerdown/keydown→activation gap lets an off-UI-thread
 *   handler refresh `copy` in time — see copy-behavior's "Lazy content" note).
 * - `click` on an `<a-button>` host → `runCopy` (buttons activate via click; a
 *   keyboard activation is a synthesized `el.click()`, so this covers both).
 * - `menuselect` on an `<a-menu-item>` host → `runCopy` (menu rows activate via
 *   the menu's pre-filtered `menuselect`, not a click).
 *
 * The copy attributes (`copy` / `copy-node` / `copy-url` / `copy-with-url`) live
 * on THIS element, and `copydone` / `copyrequest` fire on it, so a wrapper binds
 * its feedback handlers directly on `<a-copy>`.
 *
 * ## The `toast` ghost
 *
 * `<a-button>` sets `overflow: hidden` (label ellipsis + loading stripe), so a
 * feedback element rendered inside it can't animate up and out — it'd be clipped.
 * With `toast`, `<a-copy>` renders the ghost in the **top layer** (a `popover`,
 * which no ancestor's overflow clips) and JS-positions it over the rendered
 * label, copying its text and wrapping shape so it reads as a ghost of the
 * button lifting away. It's a
 * functional cue (it conveys "copied"), not decorative motion, so it plays
 * regardless of `prefers-reduced-motion`. `ButtonCopy` opts in; `MenuItemCopy`
 * does not (its menu is kept open via `data-menu-open`, so the icon/tone swap is
 * the feedback).
 *
 * Declarative-DOM-safe: mutates only its own shadow, reads the host with
 * `closest` / `getBoundingClientRect`, and adds listeners (never attributes) to
 * the document — no light-DOM mutation, so it holds where the app tree is
 * reconciled off the UI thread.
 */

/** Hosts whose activation triggers a copy. Buttons activate on `click`; menu
 *  rows on `menuselect`. The pre-request (`pointerdown`/`keydown`) covers both. */
const BUTTON_HOST = "a-button, button, [role=button]";
const MENU_HOST = "a-menu-item, [role=menuitem]";
const ANY_HOST = `${BUTTON_HOST}, ${MENU_HOST}`;

/** The `<a-copy>` belonging to a host — the direct child a wrapper drops in. */
function copyChild(host: Element | null): ACopyElement | null {
  return (host?.querySelector(":scope > a-copy") as ACopyElement | null) ?? null;
}

/** A host that can't be activated (disabled / loading) swallows the copy. */
function hostBlocked(host: Element): boolean {
  return (
    host.hasAttribute("disabled") ||
    host.hasAttribute("loading") ||
    host.getAttribute("aria-disabled") === "true"
  );
}

/** Install the one-per-document delegated handlers (idempotent). Mirrors
 *  `<a-button>`'s single delegated set — no listeners hang off individual hosts. */
function installCopyDelegation(doc: Document | undefined) {
  if (!doc || doc.hasCopyDelegation) return;

  const preRequest = (target: EventTarget | null) => {
    const host = (target as HTMLElement)?.closest?.(ANY_HOST);
    if (!host || hostBlocked(host)) return;
    const el = copyChild(host);
    if (el) emitCopyRequest(el);
  };

  doc.addEventListener("pointerdown", (e) => preRequest(e.target), true);
  doc.addEventListener(
    "keydown",
    (e) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ")
        preRequest(e.target);
    },
    true,
  );
  // Button activation: a real click (keyboard activation is a synthesized click).
  doc.addEventListener(
    "click",
    (e) => {
      const host = (e.target as HTMLElement)?.closest?.(BUTTON_HOST);
      if (!host || hostBlocked(host)) return;
      copyChild(host)?.activate();
    },
    true,
  );
  // Menu-row activation: the menu's pre-filtered `menuselect` (non-bubbling —
  // caught here in the capture phase).
  doc.addEventListener(
    "menuselect",
    (e) => {
      const host = (e.target as HTMLElement)?.closest?.(MENU_HOST);
      if (!host || hostBlocked(host)) return;
      copyChild(host)?.activate();
    },
    true,
  );

  doc.hasCopyDelegation = true;
}

/** How long the ghost lives before it's pulled from the top layer (ms). Matches
 *  the rise animation, then dismisses the popover. */
const GHOST_MS = 650;

/** CSS that determines the text's rendered shape. The ghost lives in this
 * element's shadow/top layer, so it can't inherit the document's label rules;
 * copy the computed values from the source label instead. Layout properties
 * such as `display` / `overflow` deliberately stay local: the measured width
 * and height below are authoritative, and the ghost must remain unclipped. */
const GHOST_TEXT_PROPERTIES = [
  "padding",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-stretch",
  "font-variation-settings",
  "font-feature-settings",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "white-space",
  "text-wrap",
  "overflow-wrap",
  "word-break",
  "line-break",
  "hyphens",
  "text-align",
  "text-indent",
  "text-transform",
  "text-decoration",
  "text-decoration-color",
  "text-decoration-style",
  "text-decoration-thickness",
  "text-underline-offset",
  "direction",
  "writing-mode",
] as const;

/** Prefer the one direct Anta label when there is one. A native/composed host
 * still works: its own box and inherited typography are the closest available
 * rendering source. Two labels are intentionally treated as host content — a
 * single text ghost cannot faithfully map two independently positioned boxes. */
function ghostSource(host: Element): HTMLElement {
  const labels = host.querySelectorAll<HTMLElement>(":scope > a-button-label");
  return labels.length === 1 ? labels[0] : (host as HTMLElement);
}

export class ACopyElement extends HTMLElementBase {
  #ghost?: HTMLElement;
  #ghostTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    installCopyDelegation(this.doc);
    // The ghost follows a *successful* write — the element's own `copydone` —
    // not activation: the write is async and can fail, and eager feedback would
    // lie on a rejected copy. Only `toast` mode shows it, and the shadow is built
    // lazily on first show, so non-toast copies allocate nothing.
    this.addEventListener("copydone", this.#onCopyDone);
  }

  /** Run the copy for the activated host. Called from the delegated click /
   *  menuselect handlers; the ghost (if any) follows on `copydone`. */
  activate(): void {
    runCopy(this);
  }

  #onCopyDone = (e: Event) => {
    if (!this.hasAttribute("toast")) return;
    if (!(e as CustomEvent<{ ok: boolean }>).detail?.ok) return;
    const host = this.closest(ANY_HOST);
    if (host) this.#showGhost(host);
  };

  #buildShadow() {
    const root = this.attachShadow({ mode: "open" });
    // No comments inside this string — it's injected verbatim per instance.
    root.innerHTML = `<style>
  .ghost {
    position: fixed;
    margin: 0;
    padding: 0;
    border: 0;
    inset: auto;
    background: none;
    overflow: visible;
    pointer-events: none;
    display: block;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    white-space: normal;
  }
  .ghost:not(:popover-open) { display: none; }
  .ghost[data-show] { animation: a-copy-rise ${GHOST_MS - 50}ms ease-out forwards; }
  @keyframes a-copy-rise {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-1.5em); }
  }
</style><div class="ghost" part="ghost" popover="manual"></div>`;
    this.#ghost = root.querySelector(".ghost") as HTMLElement;
  }

  #showGhost(host: Element) {
    if (!this.#ghost) this.#buildShadow(); // lazy — only toast mode ever needs it
    const ghost = this.#ghost;
    // Feature-gate on the Popover API — without the top layer the ghost would be
    // clipped by the button's overflow, so skip rather than paint a clipped one.
    if (!ghost || typeof (ghost as any).showPopover !== "function") return;
    const source = ghostSource(host);
    const text = (source.textContent ?? "").trim();
    if (!text) return; // nothing to ghost (icon-only) — the icon/tone swap is the feedback

    const r = source.getBoundingClientRect();
    const style = source.ownerDocument.defaultView?.getComputedStyle(source);
    ghost.textContent = text;
    if (style) {
      for (const property of GHOST_TEXT_PROPERTIES) {
        ghost.style.setProperty(property, style.getPropertyValue(property));
      }
    }
    ghost.style.left = `${r.left}px`;
    ghost.style.top = `${r.top}px`;
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;

    clearTimeout(this.#ghostTimer);
    ghost.removeAttribute("data-show");
    // hidePopover() throws when the popover isn't showing, so only call it when
    // it is — otherwise it would throw past showPopover() and the ghost would
    // never appear on the first (or any idle) copy.
    if (ghost.matches(":popover-open")) {
      try { (ghost as any).hidePopover(); } catch { /* not open */ }
    }
    try {
      (ghost as any).showPopover();
    } catch {
      return;
    }
    // Reflow so a repeat copy restarts the animation from the top.
    void ghost.offsetWidth;
    ghost.setAttribute("data-show", "");
    this.#ghostTimer = setTimeout(() => {
      ghost.removeAttribute("data-show");
      if (ghost.matches(":popover-open")) {
        try { (ghost as any).hidePopover(); } catch { /* already closed */ }
      }
    }, GHOST_MS);
  }

  disconnectedCallback() {
    clearTimeout(this.#ghostTimer);
    this.removeEventListener("copydone", this.#onCopyDone);
  }
}

export function register_a_copy() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-copy")) {
    customElements.define("a-copy", ACopyElement);
  }
}

register_a_copy();

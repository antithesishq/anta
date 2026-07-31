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
 * `copydone` event. With `toast`, a successful copy shows a small `Copied`
 * confirmation beside the pointer. The base controls carry no copy knowledge,
 * so `<Button>` / `<MenuItem>` stay clean and `<ButtonCopy>` /
 * `<MenuItemCopy>` are thin composers that drop it in.
 *
 * ## How it observes activation (delegation, not per-instance listeners)
 *
 * Attaching a listener to every host would mean one listener per (possibly
 * offscreen) copy control — the cost `<a-button>` avoids with a single delegated
 * handler per document. `<a-copy>` does the same: `installCopyDelegation` wires
 * exactly one `pointerdown` / `keydown` / `click` / `menuselect` handler per
 * document (guarded by a flag), and each resolves the activated host from the
 * event, then the host's own `<a-copy>` child. `menuselect` is dispatched
 * `bubbles: false`, but a capture-phase document listener still sees it (the
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
 * on this element, and `copydone` / `copyrequest` fire on it, so a wrapper binds
 * its feedback handlers directly on `<a-copy>`.
 *
 * ## The confirmation label
 *
 * Button labels can wrap, truncate, or use custom layout. Copying that rendering
 * into a floating element is fragile, so `toast` shows a fixed `✓ Copied` label
 * instead. It lives in the top layer because `<a-button>` clips overflow. Pointer
 * activation places it above the pointer; keyboard activation falls back to the
 * host's logical start edge. `copied-label` changes only the label text.
 *
 * Declarative-DOM-safe: mutates only its own shadow, reads the host with
 * `closest` / `getBoundingClientRect`, and adds listeners (never attributes) to
 * the document — no light-DOM mutation, so it holds where the app tree is
 * reconciled off the UI thread.
 */

/** Hosts whose activation triggers a copy. Buttons activate on `click`; menu
 * rows on `menuselect`. The pre-request (`pointerdown`/`keydown`) covers both. */
const BUTTON_HOST = "a-button, button, [role=button]";
const MENU_HOST = "a-menu-item, [role=menuitem]";
const ANY_HOST = `${BUTTON_HOST}, ${MENU_HOST}`;

type PointerOrigin = { x: number; y: number };
const pointerOrigins = new WeakMap<ACopyElement, PointerOrigin>();

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
 * `<a-button>`'s single delegated set — no listeners hang off individual hosts. */
function installCopyDelegation(doc: Document | undefined) {
  if (!doc || doc.hasCopyDelegation) return;

  const preRequest = (target: EventTarget | null, origin?: PointerOrigin) => {
    const host = (target as HTMLElement)?.closest?.(ANY_HOST);
    if (!host || hostBlocked(host)) return;
    const el = copyChild(host);
    if (!el) return;
    if (origin) pointerOrigins.set(el, origin);
    else pointerOrigins.delete(el);
    emitCopyRequest(el);
  };

  doc.addEventListener(
    "pointerdown",
    (e) => preRequest(e.target, { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY }),
    true,
  );
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
      const el = copyChild(host);
      if (!el) return;
      if ((e as MouseEvent).detail)
        pointerOrigins.set(el, { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY });
      else pointerOrigins.delete(el);
      el.activate();
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

/** How long the confirmation label lives before it leaves the top layer (ms). */
const FEEDBACK_MS = 900;

const COPY_FEEDBACK_TEMPLATE = typeof document === "undefined" ? undefined : (() => {
  const template = document.createElement("template");
  const style = document.createElement("style");
  style.textContent = `
    .feedback {
      position: fixed;
      margin: 0;
      padding: 0;
      border: 0;
      inset: auto;
      background: none;
      overflow: visible;
      pointer-events: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-sizing: border-box;
      color: var(--text-2-success);
      font-family: var(--sans-serif);
      font-size: 13px;
      line-height: 16px;
      font-weight: 500;
      white-space: nowrap;
      transform: translate(var(--_feedback-x), calc(-100% - 10px));
    }
    .feedback:not(:popover-open) { display: none; }
    .feedback[data-show] { animation: a-copy-feedback-rise ${FEEDBACK_MS}ms ease-out forwards; }
    @keyframes a-copy-feedback-rise {
      from { opacity: 1; transform: translate(var(--_feedback-x), calc(-100% - 10px)); }
      to { opacity: 0; transform: translate(var(--_feedback-x), calc(-100% - 1.5em)); }
    }
  `;
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  feedback.part.add("feedback");
  feedback.setAttribute("popover", "manual");
  feedback.setAttribute("role", "status");
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✓";
  const label = document.createElement("span");
  label.className = "label";
  feedback.append(icon, label);
  template.content.append(style, feedback);
  return template;
})();

export class ACopyElement extends HTMLElementBase {
  #feedback?: HTMLElement;
  #feedbackLabel?: HTMLElement;
  #feedbackTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    installCopyDelegation(this.doc);
    this.addEventListener("copydone", this.#onCopyDone);
  }

  /** Run the copy for the activated host. Called from the delegated click /
   * menuselect handlers; the confirmation follows a successful `copydone`. */
  activate(): void {
    runCopy(this);
  }

  #onCopyDone = (e: Event) => {
    const origin = pointerOrigins.get(this);
    pointerOrigins.delete(this);
    if (!this.hasAttribute("toast")) return;
    if (!(e as CustomEvent<{ ok: boolean }>).detail?.ok) return;
    const host = this.closest(ANY_HOST);
    if (host) this.#showFeedback(host, origin);
  };

  #buildShadow() {
    if (!COPY_FEEDBACK_TEMPLATE) return;
    const root = this.attachShadow({ mode: "open" });
    root.append(COPY_FEEDBACK_TEMPLATE.content.cloneNode(true));
    this.#feedback = root.querySelector<HTMLElement>(".feedback")!;
    this.#feedbackLabel = root.querySelector<HTMLElement>(".label")!;
  }

  #showFeedback(host: Element, origin?: PointerOrigin) {
    if (!this.#feedback) this.#buildShadow();
    const feedback = this.#feedback;
    const label = this.#feedbackLabel;
    if (!feedback || !label) return;

    label.textContent = this.getAttribute("copied-label") ?? "Copied";
    if (origin) {
      feedback.style.left = `${origin.x}px`;
      feedback.style.top = `${origin.y}px`;
      feedback.style.setProperty("--_feedback-x", "8px");
    } else {
      const rect = host.getBoundingClientRect();
      const rtl = this.view.getComputedStyle(host).direction === "rtl";
      feedback.style.left = `${rtl ? rect.right - 12 : rect.left + 12}px`;
      feedback.style.top = `${rect.top}px`;
      feedback.style.setProperty("--_feedback-x", rtl ? "-100%" : "0");
    }

    clearTimeout(this.#feedbackTimer);
    feedback.removeAttribute("data-show");
    if (feedback.matches(":popover-open")) feedback.hidePopover();
    feedback.showPopover();
    void feedback.offsetWidth;
    feedback.setAttribute("data-show", "");
    this.#feedbackTimer = setTimeout(() => {
      feedback.removeAttribute("data-show");
      if (feedback.matches(":popover-open")) feedback.hidePopover();
    }, FEEDBACK_MS);
  }

  disconnectedCallback() {
    clearTimeout(this.#feedbackTimer);
    pointerOrigins.delete(this);
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

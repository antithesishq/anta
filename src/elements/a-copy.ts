import { HTMLElementBase } from "../anta_helpers";
import { emitCopyRequest, runCopy } from "./copy-behavior";
import "./a-copy.css";

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
 * handler per document. `<a-copy>` does the same: `copyDelegation` wires
 * exactly one `pointerdown` / `keydown` / `click` / `menuselect` handler per
 * document while copy elements are connected. Each resolves the activated host
 * from the event, then the host's own `<a-copy>` child. `menuselect` is dispatched
 * `bubbles: false`, but a capture-phase document listener still sees it (the
 * capture phase runs root→target regardless of bubbling), so menu rows need no
 * special path.
 *
 * - `pointerdown` / `keydown` (Enter/Space) → `emitCopyRequest`, so an
 *   application can refresh a controlled `copy` value before activation.
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
const COPY_DELEGATION = Symbol.for("anta.copy-delegation");
type CopyDelegation = {
  readers: Set<Element>;
  origins: WeakMap<Element, PointerOrigin>;
  dispose: () => void;
};
type CopyDocument = Document & { [COPY_DELEGATION]?: CopyDelegation };

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

/** Share one delegated set across independent full and granular builds. */
function copyDelegation(doc: CopyDocument): CopyDelegation {
  if (doc[COPY_DELEGATION]) return doc[COPY_DELEGATION];
  const origins = new WeakMap<Element, PointerOrigin>();
  // Resolve the nearest activatable region before filtering its activation kind.
  // An inner menu item or native control must not activate an ancestor copy.
  const hostFor = (event: Event) => event.composedPath().find((node) =>
    (node as Element).matches?.(ANY_HOST)) as Element | undefined;
  const preRequest = (event: Event, origin?: PointerOrigin) => {
    const host = hostFor(event);
    if (!host || hostBlocked(host)) return;
    const el = copyChild(host);
    if (!el) return;
    if (origin) origins.set(el, origin);
    else origins.delete(el);
    emitCopyRequest(el);
  };
  const pointerdown = (e: PointerEvent) => preRequest(e, { x: e.clientX, y: e.clientY });
  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") preRequest(e);
  };
  const click = (e: MouseEvent) => {
    const host = hostFor(e);
    if (!host?.matches(BUTTON_HOST) || hostBlocked(host)) return;
    const el = copyChild(host);
    if (!el) return;
    if (e.detail) origins.set(el, { x: e.clientX, y: e.clientY });
    else origins.delete(el);
    el.activate();
  };
  const menuselect = (e: Event) => {
    const host = hostFor(e);
    if (!host?.matches(MENU_HOST) || hostBlocked(host)) return;
    copyChild(host)?.activate();
  };
  doc.addEventListener("pointerdown", pointerdown, true);
  doc.addEventListener("keydown", keydown, true);
  doc.addEventListener("click", click, true);
  doc.addEventListener("menuselect", menuselect, true);
  const delegation: CopyDelegation = {
    readers: new Set(), origins,
    dispose: () => {
      doc.removeEventListener("pointerdown", pointerdown, true);
      doc.removeEventListener("keydown", keydown, true);
      doc.removeEventListener("click", click, true);
      doc.removeEventListener("menuselect", menuselect, true);
      delete doc[COPY_DELEGATION];
    },
  };
  doc[COPY_DELEGATION] = delegation;
  return delegation;
}

/** How long the confirmation label lives before it leaves the top layer (ms). */
const FEEDBACK_MS = 900;

const COPY_FEEDBACK_TEMPLATE = typeof document === "undefined" ? undefined : (() => {
  const template = document.createElement("template");
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
  template.content.append(feedback);
  return template;
})();

export class ACopyElement extends HTMLElementBase {
  #feedback?: HTMLElement;
  #feedbackLabel?: HTMLElement;
  #feedbackTimer?: number;
  #timerView?: Window;
  #delegation?: CopyDelegation;
  #generation = 0;
  #completion?: { current: boolean; origin?: PointerOrigin };
  #animation?: Animation;
  #motion?: { above: string[]; below: string[]; opacity: string[]; easing: string };

  connectedCallback() {
    this.#delegation = copyDelegation(this.doc);
    this.#delegation.readers.add(this);
    this.addEventListener("copydone", this.#onCopyDone);
  }

  /** Run the copy for the activated host. Called from the delegated click /
   * menuselect handlers; the confirmation follows a successful `copydone`. */
  activate(): void {
    const generation = this.#generation;
    const origin = this.#delegation?.origins.get(this);
    this.#delegation?.origins.delete(this);
    runCopy(this, (ok) => {
      this.#completion = { current: this.isConnected && generation === this.#generation, origin };
      try {
        this.dispatchEvent(new this.view.CustomEvent("copydone", { detail: { ok } }));
      } finally {
        this.#completion = undefined;
      }
    });
  }

  #onCopyDone = (e: Event) => {
    if (e.target !== this || this.#completion?.current === false || !this.isConnected) return;
    const origin = this.#completion ? this.#completion.origin : this.#delegation?.origins.get(this);
    if (!this.#completion) this.#delegation?.origins.delete(this);
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
    let belowTop: number;
    if (origin) {
      feedback.style.left = `${origin.x}px`;
      feedback.style.top = `${origin.y}px`;
      feedback.style.translate = "8px 0";
      belowTop = origin.y;
    } else {
      const rect = host.getBoundingClientRect();
      const rtl = this.view.getComputedStyle(host).direction === "rtl";
      feedback.style.left = `${rtl ? rect.right - 12 : rect.left + 12}px`;
      feedback.style.top = `${rect.top}px`;
      feedback.style.translate = rtl ? "-100% 0" : "0 0";
      belowTop = rect.bottom;
    }

    this.#clearFeedback();
    feedback.showPopover();
    if (!this.#motion) {
      // Literal CSS endpoints avoid shadow keyframe lookup and Firefox var() effects.
      const styles = this.view.getComputedStyle(feedback);
      this.#motion = {
        opacity: [styles.getPropertyValue("--_copy-opacity-from").trim(), styles.getPropertyValue("--_copy-opacity-to").trim()],
        easing: styles.getPropertyValue("--_copy-easing").trim(),
        above: [styles.getPropertyValue("--_copy-above-from").trim(), styles.getPropertyValue("--_copy-above-to").trim()],
        below: [styles.getPropertyValue("--_copy-below-from").trim(), styles.getPropertyValue("--_copy-below-to").trim()],
      };
    }
    feedback.style.transform = this.#motion.above[1];
    const below = feedback.getBoundingClientRect().top < 0;
    if (below) feedback.style.top = `${belowTop}px`;
    const transforms = below ? this.#motion.below : this.#motion.above;
    feedback.style.transform = transforms[0];
    if (!this.#animation) {
      this.#animation = feedback.animate({ opacity: this.#motion.opacity, transform: transforms }, {
        duration: FEEDBACK_MS, easing: this.#motion.easing, fill: "forwards",
      });
    } else {
      (this.#animation.effect as KeyframeEffect).setKeyframes({ opacity: this.#motion.opacity, transform: transforms });
      this.#animation.play();
    }
    this.#animation.currentTime = 0;
    this.#timerView = this.view;
    this.#feedbackTimer = this.#timerView.setTimeout(() => this.#clearFeedback(), FEEDBACK_MS);
  }

  #clearFeedback() {
    if (this.#feedbackTimer != null) this.#timerView?.clearTimeout(this.#feedbackTimer);
    this.#feedbackTimer = undefined;
    this.#timerView = undefined;
    this.#animation?.cancel();
    if (this.#feedback?.matches(":popover-open")) this.#feedback.hidePopover();
  }

  disconnectedCallback() {
    this.#generation++;
    this.#clearFeedback();
    this.#animation = undefined;
    this.#motion = undefined;
    this.#delegation?.origins.delete(this);
    this.#delegation?.readers.delete(this);
    if (this.#delegation?.readers.size === 0) this.#delegation.dispose();
    this.#delegation = undefined;
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

import { HTMLElementBase } from "../anta_helpers";
import { emitCopyRequest, runCopy } from "./copy-behavior";
import { installKeyActivation } from "./key-activation";
import "./a-button.css";

declare global {
  interface Document {
    hasKeyListenerForAButton?: boolean;
  }
}

/** Install the one-per-document delegated key/click handlers that power Enter/
 *  Space activation, form submit/reset, and `data-custom-event`. Idempotent
 *  per document (the guard flag lives on the document object). Bind to the
 *  element's OWN document (`this.doc`) rather than the module-global `document`:
 *  the class may be defined in the parent page while the element lives in an
 *  iframe (the docs playground), so a parent-frame listener would never see the
 *  iframe's events. Called from connectedCallback with `this.doc` (the button's
 *  real frame) and eagerly at registration with the registering frame's
 *  `document` (best-effort, before the first connect). */
function installDocumentHandlers(doc: Document | undefined) {
  if (!doc || doc.hasKeyListenerForAButton) return;
  // Enter/Space activate on keyup (shared with a-menu-item) — keydown arms the
  // release and issues the lazy-copy pre-request; keyup clicks. See key-activation.
  installKeyActivation(doc, {
    keys: ["Enter", " "],
    resolve: (t) =>
      (t as HTMLElement)?.closest?.("a-button") as AButtonElement | null,
    blocked: (el) =>
      el.hasAttribute("disabled") || el.hasAttribute("loading"),
    preflight: (el) => (el as AButtonElement).requestCopy(),
    activate: (el) => el.click(),
  });
  // Lazy copy: ask the consumer for fresh content on pointerdown so a
  // worker-thread handler has the pointerdown→click gap to set `copy` before
  // the click reads it (see copy-behavior's "Lazy content" note).
  doc.addEventListener("pointerdown", handlePointerDown, true);
  doc.addEventListener("click", handleClick, true);
  doc.hasKeyListenerForAButton = true;
}

/**
 * `<a-button>` — button element (also styles `a[role="button"]`).
 *
 * Styling notes (`a-button.css` ships comment-free):
 * - **Token architecture.** The base rule carries shared constants plus the
 *   neutral tone tokens (neutral is the implicit default; its chip uses a
 *   softer 5% rest alpha vs 10% for named tones). Named tones override via
 *   `[tone="X"]`; critical/warning tertiary active steps heavier (20% vs
 *   15%). Final colors are wired through `--button-fg`/`--button-bg`:
 *   secondary is declared unscoped so a bare `a-button` consumer selector
 *   can override it without bumping specificity; primary/tertiary/quaternary
 *   match an explicit `[priority]` and win on specificity. Secondary's rest
 *   label is darkened by `--button-fg-secondary-l-shift` oklch lightness
 *   (0.05 light mode, zeroed in dark) at the `--button-fg` wiring, so it
 *   covers named and custom tones alike; secondary also carries a 1px
 *   hairline box-shadow in the current fg tone at 50% alpha, which the
 *   other priorities cancel in their own blocks. `[selected]` adds a 1px
 *   inset ring in `currentColor`, declared after the priority blocks so it
 *   survives their `box-shadow: none` cancels.
 * - **Dark mode** re-tunes with heavier alphas (30/40% vs 10/15%) and flips
 *   neutral's anchor to a lilac — mixing dark gray into a dark bg yields no
 *   contrast.
 * - **Custom tones** (any non-named `tone` value): primary uses the literal
 *   color; other priorities derive from the source HUE via oklch relative
 *   color with lightness/chroma/alpha pinned near Brand. The `--_tone-*`
 *   knobs are the only numbers to tune (the `.dark` block re-tunes them).
 *   The JSX wrapper writes `--button-tone-source` inline; a typed `attr()`
 *   fallback picks up raw `<a-button tone="…">` on Chrome 133+/Safari 18.2+.
 * - **Hover is gated** to `(hover: hover) and (pointer: fine)` so it doesn't
 *   stick after a tap; `:active`/`[selected]` stay ungated (correct press
 *   feedback on touch). Quaternary rests at 90% fg alpha with a slightly
 *   heavier `font-weight: 415` (quieter than tertiary but legible), restores
 *   full opacity on hover, lightens by 0.05 oklch L on press (dark mode
 *   returns to rest instead — it's already light), and has instant
 *   transitions in every direction.
 * - **Layout gotchas:** `flex-shrink: 0` (shrinking + `overflow: hidden`
 *   would clip the label silently); `font-variation-settings` must restate
 *   ALL axes — it replaces rather than merges, and dropping "slnt"/"ital"
 *   renders italic in Safari; the label uses a 17px line box + 1px bottom
 *   padding for optical vertical centering at an unchanged 18px box.
 * - **Icon-only** is purely structural — `:has(> a-icon:only-child)` gives
 *   square padding + a min-size pin (and centers when the host is sized
 *   bigger). A non-only edge icon trims ~2px off its side's padding
 *   (optical), `max(0px, …)` keeping paddingless at 0.
 * - **Underline** renders only on tertiary/quaternary: 0.5px hairline at 75%
 *   alpha at rest, 1px at full alpha on hover/`[selected]`, mirroring the
 *   prose-link rule in `<Text>`.
 * - **Loading** paints a blurred diagonal stripe overlay; the x-period is
 *   the diagonal period projected onto x so the slide loops seamlessly
 *   (overshooting left by one period), and a large negative
 *   `animation-delay` desyncs instances so a row doesn't pulse in lockstep.
 * - **Disabled** sets `background-color`/`color` directly (not the vars) so
 *   an inline `--button-bg` override can't keep a disabled button alive, and
 *   skips transitions — a `.dark` toggle would flash the tone hue
 *   mid-resolve.
 */
export class AButtonElement extends HTMLElementBase {
  connectedCallback() {
    // Install on the button's OWN document so activation works in whatever
    // frame the element actually lives in (parent page or playground iframe).
    installDocumentHandlers(this.doc);
  }

  /** Perform a copy if this button is a copy control (`copy` / `copy-node` /
   *  `copy-url`). Called from the delegated click handler on activation. The
   *  outcome is announced via a `copydone` event the wrapper reflects. */
  performCopy(): boolean {
    return runCopy(this);
  }

  /** Ask a lazy consumer to refresh the `copy` value on pointerdown (fires a
   *  `copyrequest` event); the click then copies whatever `copy` holds. */
  requestCopy(): void {
    emitCopyRequest(this);
  }
}

function findForm(el: HTMLElement): HTMLFormElement | null {
  const formId = el.getAttribute("form");
  if (formId) {
    return el.ownerDocument.getElementById(formId) as HTMLFormElement | null;
  }
  return el.closest("form");
}

function handlePointerDown(e: PointerEvent) {
  const el = (e.target as HTMLElement).closest(
    "a-button",
  ) as AButtonElement | null;
  if (!el) return;
  if (el.hasAttribute("disabled") || el.hasAttribute("loading")) return;
  el.requestCopy();
}

function handleClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest(
    "a-button",
  ) as AButtonElement | null;
  if (!el) return;
  // Block activation while disabled / loading — also covers a programmatic
  // `el.click()` that bypasses the CSS pointer-events guard.
  if (el.hasAttribute("disabled") || el.hasAttribute("loading")) return;

  // Optional bubbling event for analytics / workflow handlers.
  const customEvent = el.getAttribute("data-custom-event");
  if (customEvent) {
    el.dispatchEvent(
      new CustomEvent(customEvent, { bubbles: true, cancelable: true }),
    );
  }

  // Copy controls (`copy` / `copy-node` / `copy-url`) write to the clipboard on
  // this same activation and reflect the outcome as feedback state — independent
  // of the form logic below (a copy button is a plain `type="button"`).
  el.performCopy();

  const type = el.getAttribute("type") || "button";
  const form = findForm(el);
  if (!form) return;

  if (type === "submit") {
    // requestSubmit() (not submit()) so the form fires its `submit` event and
    // runs constraint validation. Baseline-available on every engine anta
    // targets (it relies on the Popover API elsewhere), so no fallback.
    form.requestSubmit();
    // Richer event so listeners can inspect which button submitted.
    const formData = new FormData(form);
    form.dispatchEvent(
      new CustomEvent("submitdetailed", {
        bubbles: true,
        cancelable: true,
        detail: {
          formData: Object.fromEntries(formData.entries()),
          submitter: {
            tag: el.tagName.toLowerCase(),
            attrs: Object.fromEntries(
              Array.from(el.attributes).map((a) => [a.name, a.value]),
            ),
          },
        },
      }),
    );
  } else if (type === "reset") {
    form.reset();
  }
}

export function register_a_button() {
  if (typeof customElements === "undefined") return;
  // Eager install on the registering frame's document so the delegated
  // handlers exist as soon as a-button is defined — before any button (incl. a
  // wrapper-rendered clear button) is first clicked. connectedCallback then
  // installs on each element's own document (covers cross-frame / iframe).
  installDocumentHandlers(typeof document !== "undefined" ? document : undefined);
  if (!customElements.get("a-button")) {
    customElements.define("a-button", AButtonElement);
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_button();

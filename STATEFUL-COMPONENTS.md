# Stateful components — the `state` contract

How every interactive component with a discrete state (expander, menu, checkbox,
and future ones) encodes that state. One vocabulary, one event shape, one
control model — so consumers learn it once.

## The three attributes

| attribute | who writes it | meaning |
|---|---|---|
| `state` | the consumer (controlled) | **string enum**, the live source of truth. *Present → controlled.* *Absent → uncontrolled.* |
| `default-state` | the consumer (uncontrolled) | the **initial** state, read once at connect / form-reset. Later changes ignored. |
| `:state(…)` | the element (via `ElementInternals`) | the **output** styling hook for CSS (`:state(open)`). Never a host attribute. |

Note the duality: the **`state` attribute** flows *in* (consumer → element); the
**`:state()` custom state** flows *out* (element → CSS). Same word, opposite
directions — don't confuse the lever with the hook.

## Vocabulary (Radix / shadcn `data-state` values, verbatim)

| component | `state` values |
|---|---|
| expander | `open` · `closed` |
| menu | `open` · `closed` |
| checkbox | `checked` · `unchecked` · `indeterminate` |

Present tense, never past (`open`, not `opened`). New components keep adopting
Radix's `data-state` vocabulary rather than coining their own.

## One event shape — `statechange`, cancelable, fired *before* applying

Each component fires a single `statechange` event, **before** it applies any
change, and it is **cancelable**:

```ts
CustomEvent<{ next: State; prev: State }>   // cancelable: true; State = the attribute's enum
```

- The payload speaks the **same vocabulary as the attribute**, so a controlled
  handler answers literally with `el.setAttribute('state', e.detail.next)` (the
  wrapper does this for you — see Wrapper props). `next` is the *requested* state;
  `prev` is what it's leaving. (Not `new` — that's a reserved word and can't be
  destructured cleanly.)
- **`detail` carries what the *component* decided, never what the *caller* already
  has.** Just `{ next, prev }`, plus genuinely *derived* results the caller can't
  recompute — a menu's selected value, its computed placement `coord`, the
  originating event. Do **not** echo back the caller's own inputs (`id`,
  `className`, attributes, `textContent`): the caller set them, so they're in its
  render scope already (and live on `event.target` for vanilla — even if a ref is
  awkward to reach off-thread, there's still nothing to echo, because the caller
  knew them upfront). Echoing only adds per-event cost, a second source of truth,
  and an unbounded, loosely-typed payload.
- `preventDefault()` vetoes the transition (see the control model). The element
  gates its own application on `dispatchEvent(evt)` returning `true`.
- No booleans in the payload — never make a handler translate `true` into `"open"`.
- **Neither bubbles nor composed.** `statechange` is a point-to-point *request*
  to the element's own wrapper — which binds the listener on the host itself, in
  the same light tree — not a notification meant for delegation. The name is
  shared across every stateful element but the `detail` vocabulary is
  per-component (`"open"` vs `"checked"` vs a value), so a bubbling event would
  reach an ancestor listener that reads it in the wrong vocabulary: toggling a
  `<Checkbox>` inside a controlled `<Dialog>` would surface as `next: "unchecked"`
  on the dialog's handler, `!== "open"`, and dismiss the dialog. `composed: true`
  is the shadow-boundary form of the same over-propagation and comes off with it.
  This matches the native precedent — `<dialog>`'s `cancel` / `close` don't bubble
  either, so a nested dialog's close isn't misread by an outer one.
- The **post-apply `change`** event (checkbox / tabs / radio-group) is the
  opposite: it *does* bubble (not composed), like a native form control's
  `change` — that one is a notification, not a request.

This mirrors the native cancelable-before pattern (`beforetoggle`, dialog
`cancel`): fire before, let a handler veto, then apply — so a veto never flickers.

## Control model — rejectable everywhere, two ways

- **Uncontrolled** (`state` absent): the element owns its state. On interaction it
  computes the next state, fires the cancelable `statechange`, and applies it
  **only if not prevented**. So an uncontrolled consumer can veto a single
  transition with `e.preventDefault()` (e.g. "confirm before closing") *without*
  lifting all state into controlled mode. Seeded once by `default-state`.
- **Controlled** (`state` present): the element never self-applies. `statechange`
  is a pure request; the consumer accepts by updating `state` and rejects by doing
  nothing (React's controlled `<input value>` model). `preventDefault()` has
  nothing to cancel here — not-updating is the veto.

One rule, both modes: **`preventDefault()` (or, when controlled, not updating
`state`) stops the change; the element never optimistically self-paints then
reverts.**

### Why `preventDefault()` cancels anything

For a `CustomEvent` there is no browser default action — `preventDefault()` only
flips a flag, and it's the *dispatcher* that must honor it. The element is both
the dispatcher and the implementer of the "default action," which is **applying
the new state**. In uncontrolled mode the element was about to apply, so the veto
has something to cancel; in controlled mode it never self-applies, so the veto is
a harmless no-op (the real reject is not updating `state`).

`dispatchEvent()` is **synchronous** and returns `false` iff a listener called
`preventDefault()`, so the whole control model is one algorithm every stateful
element runs:

```ts
onInteraction(next) {
  const evt = new CustomEvent('statechange', {
    cancelable: true,
    detail: { next, prev: this.current },
  })
  const ok = this.dispatchEvent(evt)   // false if a handler synchronously preventDefault()'d
  if (this.controlled) return          // controlled: never self-apply — wait for the new attribute value
  if (ok) this.apply(next)             // uncontrolled: apply unless vetoed
}
// controlled ≡ this.hasAttribute('state')
```

**Cancelation is synchronous-only.** `dispatchEvent` has already returned by the
next tick, so a handler must call `preventDefault()` inline — you cannot `await`
and then cancel (same constraint as a native `submit`). For an asynchronous
decision, use controlled mode instead: don't apply, decide whenever, then set
`state`.

## Bare `state`, not `data-state`

We own the `a-*` tag namespace and the house style is bare attributes (`tone`,
`priority`, `level`). So the attribute is bare `state`; only the *values* are
borrowed from Radix's `data-state`.

## Wrapper props (React / Preact)

One vocabulary all the way up: `state` attribute → `statechange` event →
**`onStateChange`** prop → `:state()` hook. The element speaks the string enum;
the wrapper is the impedance match to React idiom — boolean for a binary state,
a string union only where there's a third state. (This is the same translation
the wrapper already does for `disabled: boolean` → `disabled=""`, and it mirrors
Radix's `checked?: boolean | 'indeterminate'`.)

| element attribute / event | wrapper prop(s) |
|---|---|
| `state` (controlled) | `open?: boolean` · `checked?: boolean \| 'indeterminate'` — boolean when arity 2, union when arity > 2 |
| `default-state` (uncontrolled) | `defaultOpen?: boolean` · `defaultChecked?: boolean \| 'indeterminate'` |
| `statechange` event | **`onStateChange`** — the one name on every component |

`onStateChange` is uniform on purpose — not `onToggle` / `onChange` / `onOpenChange`.
A single name pairs with the `state`/`statechange`/`:state()` vocabulary, and it
deliberately avoids reusing native `onChange` (whose handler reads `e.target.checked`,
a different shape from our `{ next, prev }` — same name, wrong contract).

- The wrapper emits `state` only when the controlled prop is defined, and
  `default-state` only in the uncontrolled case — never both, so the DOM never
  carries a stale state attribute.
- **The callback is event-first, detail second:**
  `onStateChange?: (event: CustomEvent, detail: { next: V; prev: V }) => void`,
  where `V` is the component's value type (boolean for binary, `boolean |
  'indeterminate'` for checkbox). Event first so `event.preventDefault()` — the
  synchronous uncontrolled veto — is front and center; `detail` is the wrapper's
  *normalized* `e.detail`, so consumers never touch the renderer-specific path
  (raw `e.detail` vs `e.nativeEvent.detail`). Typical use:
  `onStateChange={(e, { next }) => next ? setOpen(true) : e.preventDefault()}`.
- Internally the wrapper binds the all-lowercase `onstatechange` so both React 19
  (which keeps the case after `on`) and Preact attach a native listener to our
  custom event — that native-listener path is what lets `preventDefault()` reach
  the element's `dispatchEvent()` return.

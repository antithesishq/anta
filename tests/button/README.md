# Button property-based browser harness

This folder will hold a small Button-focused PBT harness for Anta.

## Problem

Testing generated demo apps with Anta components quickly shifts attention away from Anta and toward the demo app's own logic. A todo list, weather app, or habit tracker mostly tests the app's domain behavior. It only indirectly tests the component library.

Anta consumers primarily interact with components by passing props and children. Button has a wide public surface: content shape, visual props, disabled/loading state, href mode, form mode, events, and inherited root props. The useful test target is therefore not a random app. It is a component lab that generates many Button scenarios and validates the Button contract under browser interaction.

## Proposed harness

Build a tiny test app that renders one generated Button scenario at a time.

- Hegel generates a deterministic corpus of valid Button scenarios.
- Each scenario is serializable and can be loaded directly by URL.
- The app renders the Button in a target stage and shows a read-only diagnostic pane with JSX, scenario JSON, live snapshot JSON, and event counters.
- Bombadil uses a custom specification with actions scoped to the Button target: click, focus + Enter, focus + Space, and weighted next-scenario. It advances without wrapping; the action set is empty at the final corpus entry.
- Bombadil properties assert Button invariants from the live snapshot.

The app should be useful manually too: open it in a browser, step through scenarios, click the Button, and inspect the exact generated props.

## v1 scope

Valid `ButtonProps` scenarios:

- behavior modes: plain action, href action, form action
- content modes: label, primitive children, empty children, icon-only, icon + label, label + trailing icon
- state props: disabled, loading, selected
- visual props: priority, named tone, size, round
- form fixture: inside-form and outside-form association via `form`
- href fixture: safe local/hash URLs with harness `preventDefault()`

Initial invariants:

- render does not crash and creates exactly one actionable root
- root mode matches scenario (`a-button` vs `a[role="button"][data-anta]`)
- disabled/loading map to `aria-disabled="true"`, `tabindex="-1"`, and block click/keyboard activation
- enabled buttons activate by click, Enter, and Space
- href mode records activation and prevents navigation
- submit mode dispatches submit and `submitdetailed`; reset mode resets the fixture; button mode does neither
- content renders in the documented order and icon-only buttons have an accessible name

## v1.5 scope

Add hostile/runtime scenarios that intentionally bypass TypeScript-valid unions:

- `href` with `type`/`form`
- `paddingless` outside quaternary priority
- underline outside tertiary/quaternary priority
- strange primitive children and inherited props

These scenarios use softer robustness invariants: no crash, root still renders, disabled/loading still win, href branch wins over form branch, and no console errors.

## Bombadil feedback ideas

Track Bombadil features or action primitives we wish existed while building this harness.

Early candidates:

- Managed-browser cleanup in headed mode: close the browser instance and Dock windows Bombadil launched when a run exits (pass, failure, or time limit), without affecting the user's existing Chrome session. Offer an explicit `--keep-browser-open` debugging option rather than making cleanup opt-in.
- Successful finite-run completion: a specification needs a completion predicate or `Stop` action. Today an intentionally exhausted action set ends as `Error: no actions available`, while adding a `Wait` action only burns the remaining time limit.
- First-class scoped action helpers: interact only within an element/region without each spec hand-rolling rect/fingerprint extraction.
- Keyboard action templates for common user flows: Tab, Shift+Tab, Enter, Space, Escape, Arrow keys.
- Focus action template: focus a semantic element or element fingerprint directly.
- Composite semantic actions: “activate this control” should choose click or keyboard activation paths and report which was used.
- Viewport/resize actions if not already supported: test responsive component behavior without shell orchestration.
- Better built-in actions for custom elements with ARIA roles, not only native semantic HTML.
- Optional screenshot clipping or target-region emphasis for component-harness workflows.
- Keyboard trace navigation in `bombadil browser inspect`: use Up/Down (and optionally Page Up/Page Down) to move through recorded states without reaching for the mouse.

Keep this list honest: add items only when the harness needs them or when Bombadil specs repeat boilerplate that could be productized.

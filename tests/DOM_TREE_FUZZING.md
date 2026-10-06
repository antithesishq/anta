# Generated component-tree fuzzing

This branch preserves the experiment that generates complete Anta TSX applications with Hegel and lets Bombadil interact with the compiled preview.

## Goal

Generate nested Anta component trees that exercise combinations a hand-written component test is unlikely to cover. The generated source goes through the public `/test/` editor compiler and harness API, so the compiler and preview do not contain Hegel- or Bombadil-specific behavior.

The experiment deliberately allows broad nesting, while keeping component-owned structural relationships valid:

- `MenuItem` and `MenuItemCopy` are generated only inside `Menu`.
- `TabPanel` is generated only as part of `Tabs` or `Steps`.
- Dialogs receive matching open and close controls.
- Components that do not accept interactive children remain terminal.

## Runtime flow

1. Open `/test/?fuzz_tree=true`.
2. `CompositionCampaign.tsx` uses browser Hegel to draw one component tree.
3. The tree is rendered to ordinary TSX source.
4. `window.antaHarness.setSource()` sends that source through the same compiler used by the editor.
5. Previous and Next select deterministic cases derived from the base seed.
6. Bombadil can open the testing-only view and run browser actions against the compiled preview.

The relevant files are:

- `site/src/components/CompositionCampaign.tsx` for generation and TSX rendering.
- `site/src/components/CompositionCampaign.module.css` for case navigation.
- `site/src/components/Harness.tsx` for the general compiler and preview API.
- `tests/composition.bombadil.spec.ts` for Bombadil actions and properties.

## Controls

The campaign accepts these query parameters:

- `fuzz_tree=true` enables generation.
- `seed=<integer>` selects a deterministic sequence of cases.
- `maxDepth=<positive integer>` limits nesting depth. The default is 8.
- `maxChildren=<positive integer>` requests the maximum children per parent. The implementation caps it at 5.
- `testing=true` hides the editor so Bombadil interacts with only the compiled preview.

Example:

```text
http://localhost:4321/test/?fuzz_tree=true&seed=42&maxDepth=8&maxChildren=5
```

Start the site with `pnpm run dev`. Run Bombadil with `pnpm test:composition`.

## Current state

The tree generator covers 21 components plus structural `TabPanel` nodes. It uses one generated case at a time and disables Hegel's database and shrinking. The Bombadil specification currently exports its default properties and generic click, input, scroll, and wait actions.

The next intended work was to add component-specific actions and invariants for stateful components. The strongest candidates found during the source audit were:

- Dialog close isolation for nested dialogs. The current implementation can close both dialogs when the inner built-in close button is clicked.
- Tabs and Steps panel ownership when multiple strips share a parent.
- RadioGroup selection, roving tab stop, and form-value consistency.
- Menu open-state agreement across the trigger, host custom state, and popover.
- Slider bounds, step alignment, pointer cancellation, and range-thumb identity.
- InputDate agreement between text, committed ISO value, calendar selection, and form value.

The generator is intentionally paused here. The active experiment moved to a small set of hand-written state-transition fixtures so each property and action sequence can be understood before returning to arbitrary trees.

# Interactive component fixtures

The `/test/` harness renders `AppFixture`. Each fixture owns its component's
state and exposes the values needed by its properties on `window`. Properties
live beside their fixture; Bombadil's actions and exports are in
`bombadil.spec.ts`.

Hegel starts with 6–12 distinct components and generates a new list when
Bombadil dispatches `fixture:advance`. Each update changes one component's
props, mounts a component not already present, or unmounts one. Surviving
components keep their React key and state. Prop updates have weight 3; mounts
and unmounts have weight 1 each, subject to the 6–12 limits. The seed and app
revision determine each Hegel draw. Hegel does not shrink Bombadil failures.

| Fixture | Props varied while mounted |
| --- | --- |
| Button | disabled, loading |
| Checkbox, RadioGroup, Switch, Slider, Tabs, Expander | disabled |
| Calendar, with InputDate | disabled, locale (en-US / en-GB) |
| Input | disabled, readOnly, clearable |
| Select | disabled, clearable |
| Dialog | persistent, closable |
| Plot | zoomPan, height, points |

Checkbox, Switch, RadioGroup, Tabs, and Calendar also vary their initial state.
Slider's min, max, and step are chosen on mount and remain fixed. Labels, sizes,
orientations, options, and titles are fixed. Disabled, loading, and readOnly start with a 10% true preference on mount.
Prop updates toggle booleans and locale, and choose a different Plot height.
This deliberately spends more time in blocked states than redrawing mostly-false
props; it exercises both blocking and recovery while avoiding unchanged updates.

Bombadil uses native clicks, typing, scrolling, keyboard actions, Slider drags,
and Plot actions. Its custom advance action asks Hegel for the
next app state. A drag is one action, so this setup does not change props during
a drag. Properties include state agreement, disabled behavior, user-action
transitions, and preservation across unrelated actions. Some checks compare
coordinates, and passing runs do not prove every relevant action was attempted.

The Calendar fixture also mounts an InputDate starting at July 4, 2026. Changing
locale must preserve its date and display that date in the new format. The check
starts from matching display/value snapshots, excluding uncommitted drafts.
Run this property alone with the same harness URL and
`fixtures/calendar/locale.spec.ts`.

Plot viewport properties observe the latest callback, not canvas pixels. That
callback can be stale after a data update. The disabled check compares the next
snapshot and may miss a delayed effect. Plot pauses resize observation off screen.

## Exploration rates

The combined campaign gives clicks weight 10, Input editing weight 6, and each
other group, including app updates, weight 3. With all groups eligible, app
updates have 3 of 49 weight points, about 6.1%. Input editing favors typing over
cursor and deletion keys at 3:1 once the field is focused. Empty action groups
change the effective rate. These weights do not guarantee that a property was
exercised.

Hegel keeps prop/mount/unmount weights at 3:1:1, with invalid lifecycle choices
removed at the 6–12 limits. Changing one existing prop leaves the other props and
component state intact. A new seed does not replay Bombadil's action sequence.

A local comparison over 4,000 updates and four seeds changed props in 728 of
2,545 selected prop updates before this cleanup, and all 2,545 afterward. The
same run spent about 48% of sampled named-control states blocked, versus 12%
before. This favors transition checks over mostly-enabled operation; it is a
starting distribution, not a measured optimum for finding bugs.

## Selected findings

The four selected findings concern these contracts:

| Contract | Current coverage |
| --- | --- |
| Disabling an open Select preserves its selected value | `selectDisabledPreservesValue` |
| A controlled React Input cannot submit an edit rejected by its parent | Separate React reproduction; this Preact fixture accepts edits and does not establish this finding |
| Switching InputDate locale preserves its saved date and formats it correctly | `inputDateLocalePreservesDisplayAndValue` |
| Disabled controls are absent from FormData | `disabledControlsAreExcludedFromSubmission`, including InputDate's hidden ISO field |

These are findings to investigate, not library fixes in this PR. The fixture
campaign is mounted through Preact compatibility; its results do not establish
React-specific behavior.

## Run

Start `pnpm run dev` from the repository root, then use the displayed server port:

```sh
pnpm exec bombadil browser test --time-limit=1m \
  'http://localhost:4321/test/?editor=off&seed=42' fixtures/bombadil.spec.ts
```

Add `--headless` to hide the Chrome window. The combined campaign includes the
Select disabled-after-open property; the product fix has not been applied.
Run Plot alone with `?editor=off&only=plot&seed=42` and
`fixtures/plot/bombadil.spec.ts`; this focused campaign also resizes the browser.
Type-check with
`pnpm exec tsc -p fixtures/tsconfig.json`.

Named form controls share a form whose submission is prevented. The
`disabledControlsAreExcludedFromSubmission` property checks real `FormData`
entries against each disabled control's unique fixture name. InputDate's unnamed
visible field carries `data-fixture-submission-name` to connect its disabled state
to its separate hidden ISO field. The property covers Input, Checkbox, Switch,
RadioGroup, Slider, Calendar, and InputDate. Select has no automatic form value.
Run it alone with the same harness URL and `fixtures/form.spec.ts`. The known
InputDate disabled-submission bug is expected to fail; no product fix is included.

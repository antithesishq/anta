# Interactive component fixtures

The `/test/` harness renders `AppFixture`. Hegel starts with 6–12 distinct
components. When Bombadil dispatches `fixture:advance`, Hegel changes one prop,
mounts a missing component, or unmounts one. Surviving components keep their
keys and state. Prop updates have weight 3; mounts and unmounts have weight 1
each, subject to the 6–12 limits.

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
Slider's min, max, and step are chosen on mount. Labels, sizes, orientations,
options, and titles are fixed. Disabled, loading, and readOnly start with a 10%
true preference; updates toggle booleans and locale or choose a different Plot
height.

Bombadil uses clicks, typing, scrolling, keyboard actions, Slider drags, and Plot
actions. A custom action advances the Hegel-generated app state. A drag is one
action, so prop changes cannot interrupt it. Properties live beside each fixture
and check state agreement, disabled behavior, transitions, and preservation
across unrelated actions. Fixture state is exposed on `window` for observation.

The combined campaign weights clicks at 10, Input editing at 6, and each other
action group, including app updates, at 3. Empty groups change the effective
rates. The URL seed and revision determine Hegel's draws, not Bombadil's action
sequence. Hegel does not shrink Bombadil failures. A passing run does not prove
that every property was exercised.

The Calendar fixture also mounts an InputDate starting at July 4, 2026. Its
locale property checks that switching between en-US and en-GB preserves the date
and formats it correctly, starting from matching display/value snapshots.

Plot properties observe the latest viewport callback, not canvas pixels. The
callback can be stale after a data update; the disabled check may miss delayed
changes. Plot pauses resize observation off screen.

## Run

Start `pnpm run dev` from the repository root, then use the displayed server port:

```sh
pnpm exec bombadil browser test --time-limit=1m \
  'http://localhost:4321/test/?editor=off&seed=42' fixtures/bombadil.spec.ts
```

Add `--headless` to hide Chrome. For a focused run, use the same URL with
`fixtures/calendar/locale.spec.ts` or `fixtures/form.spec.ts`. For Plot, add
`&only=plot` to the URL and use `fixtures/plot/bombadil.spec.ts`. The Plot-only
campaign also resizes the browser. Type-check with
`pnpm exec tsc -p fixtures/tsconfig.json`.

The combined campaign includes known failure cases, including disabled
InputDate values appearing in FormData. Named controls share a form whose
submission is prevented. The form property checks Input, Checkbox, Switch,
RadioGroup, Slider, Calendar, and InputDate; Select has no automatic form value.
InputDate's visible field uses `data-fixture-submission-name` to associate its
disabled state with its separate hidden ISO field.

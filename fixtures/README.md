# Interactive component fixtures

Each fixture contains an authored TSX source string and a Bombadil specification. The harness sends the source through the `/test/` editor and compiler, then renders five independent component instances.

## Run a fixture

Start the development server from the repository root:

```sh
pnpm run dev
```

Open a fixture in the TSX editor:

```text
http://localhost:4321/test/?fixture=plot
```

Replace `plot` with `switch`, `checkbox`, `radio-group`, `input`, `calendar`, or `select-faceted`. Add `bombadil=true` to hide the editor and expose only the compiled fixture:

```text
http://localhost:4321/test/?fixture=plot&bombadil=true
```

Run the default five-minute campaign:

```sh
pnpm test:fixture plot
```

Run a 10-second smoke campaign:

```sh
BOMBADIL_TIME_LIMIT=10s pnpm test:fixture plot
```

Run every fixture:

```sh
for fixture in switch checkbox radio-group input calendar select-faceted plot; do
  pnpm test:fixture "$fixture"
done
```

Set `BOMBADIL_HEADLESS=true` to hide the managed browser. Set `ANTA_FIXTURE_ORIGIN` when the site uses another origin:

```sh
ANTA_FIXTURE_ORIGIN=http://localhost:4325 \
BOMBADIL_HEADLESS=true \
BOMBADIL_TIME_LIMIT=10s \
pnpm test:fixture switch
```

Set `BOMBADIL_OUTPUT_PATH` to change the results directory. Otherwise, Bombadil writes to `fixtures/<fixture>/.test-output`. Inspect a saved run with:

```sh
bombadil browser inspect fixtures/switch/.test-output
```

## Shared properties

Every fixture exports Bombadil's default browser properties:

- `"noHttpErrorCodes"` requires the navigation response status to stay below 400.
- `"noUncaughtExceptions"` rejects uncaught browser exceptions.
- `"noUnhandledPromiseRejections"` rejects unhandled promise rejections.
- `"noConsoleErrors"` rejects `console.error` entries.

Every fixture also checks JavaScript heap, retained DOM nodes, event listeners, and layout objects. These resource properties ignore the first 30 seconds and require a complete 60-second observation window. A 10-second smoke campaign does not exercise them.

## Switch

Bombadil selects the Switch and fixture controls. `"switchKeyboardActions"` also focuses each enabled Switch and presses Space.

- `"switchStateIsCoherent"` requires `.checked` to match `:state(checked)` and requires `tabIndex` to match the disabled state.
- `"switchHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"switchHasNoEventListenerLeak"` limits event-listener growth.
- `"switchHasNoHeapGrowth"` limits JavaScript heap growth.
- `"switchHasNoLayoutObjectLeak"` limits layout-object growth.

## Checkbox

Bombadil selects the Checkbox and fixture controls. `"checkboxKeyboardActions"` also focuses each enabled Checkbox and presses Space.

- `"checkboxStateIsCoherent"` requires the checked and indeterminate properties to match their custom states, prevents both states from being active, rejects a stale `state` attribute, and checks the disabled tab stop.
- `"checkboxHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"checkboxHasNoEventListenerLeak"` limits event-listener growth.
- `"checkboxHasNoHeapGrowth"` limits JavaScript heap growth.
- `"checkboxHasNoLayoutObjectLeak"` limits layout-object growth.

## RadioGroup

Bombadil selects options and fixture controls. `"radioGroupKeyboardActions"` presses Space, Enter, and arrow keys. `"radioGroupRapidKeyboardActions"` repeats arrow navigation two, three, or five times.

- `"radioGroupSelectionIsCoherent"` requires the group value, selected child, `:state(selected)`, and roving `tabIndex` to agree. A disabled group has no tab stop, and an enabled group has one.
- `"radioGroupHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"radioGroupHasNoEventListenerLeak"` limits event-listener growth.
- `"radioGroupHasNoHeapGrowth"` limits JavaScript heap growth.
- `"radioGroupHasNoLayoutObjectLeak"` limits layout-object growth.

## Input

Bombadil enters text and selects the controlled update, enable or disable, editable or read-only, single-line or multiline, and mount or unmount controls.

- `"inputStateIsCoherent"` requires the host and native control values to agree. It also checks `:state(filled)`, the native `input` or `textarea` choice, disabled state, and read-only state.
- `"inputHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"inputHasNoEventListenerLeak"` limits event-listener growth.
- `"inputHasNoHeapGrowth"` limits JavaScript heap growth.
- `"inputHasNoLayoutObjectLeak"` limits layout-object growth.

## Calendar

Bombadil selects dates, month controls, and fixture controls. `"calendarKeyboardActions"` presses Space, Enter, arrow keys, Home, End, Page Up, Page Down, Shift+Page Up, and Shift+Page Down.

- `"calendarSelectionIsCoherent"` requires the public value, reflected `value` attribute, and selected day to agree.
- `"disabledCalendarHasNoEnabledDays"` requires every day in a disabled Calendar to be disabled.
- `"calendarHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"calendarHasNoEventListenerLeak"` limits event-listener growth.
- `"calendarHasNoHeapGrowth"` limits JavaScript heap growth.
- `"calendarHasNoLayoutObjectLeak"` limits layout-object growth.

## SelectFaceted

Bombadil opens menus, selects and clears rows, enters search text, changes controlled values, enables and disables the component or an option, and mounts or unmounts each instance.

- `"selectFacetedOpenStateIsCoherent"` requires `aria-expanded`, `.isOpen`, `:state(open)`, and the trigger tab stop to agree.
- `"selectFacetedSelectionIndicatorsAreValid"` requires valid checkable-row roles and `aria-checked` values and prevents multiple checked rows in one radio section.
- `"selectFacetedHasNoDomNodeLeak"` limits retained DOM-node growth.
- `"selectFacetedHasNoEventListenerLeak"` limits event-listener growth.
- `"selectFacetedHasNoHeapGrowth"` limits JavaScript heap growth.
- `"selectFacetedHasNoLayoutObjectLeak"` limits layout-object growth.

## Plot

`"plotActions"` selects and double-selects canvas points, moves across nine plot positions, leaves the plot, performs Control-wheel zoom, changes data and viewport props, resizes plots, and occasionally mounts or unmounts all plots.

- `"plotHasNoDomNodeLeak"` limits retained DOM-node growth with Plot's measured transient allowance.
- `"plotHasNoEventListenerLeak"` limits event-listener growth with Plot's measured transient allowance.
- `"plotHasNoHeapGrowth"` limits JavaScript heap growth with Plot's measured transient allowance.
- `"plotHasNoLayoutObjectLeak"` limits layout-object growth with Plot's measured transient allowance.

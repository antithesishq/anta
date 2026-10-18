# Regression tests

Run `pnpm test` for general root regressions, including Markdown disclosure conversion.
CI uses the runner's installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome`.

## Component test tiers

Run the core checks for every registered component or select one suite:

```sh
CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:components --tier fast
CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:components --tier fast --component banner
pnpm test:components --tier slow --component banner
```

The shared command defaults to `fast`. `--component` accepts `all`, one suite,
or a comma-separated list. Use `--list` to inspect the selected files without
running them. Banner, Calendar/InputDate, Card, Copy, Dialog, Expander, Input, InputAutocomplete, InputTime, Menu, Progress, Select, Selection (Calendar/RadioGroup/Tabs), Slider, Text, Toaster, and Tooltip are registered.

Fast checks run selected core regressions in Chromium: initial rendering, primary
interactions, state, accessibility, and React/Preact integration where applicable.
The CSP suites keep a core case for both granular and full-bundle imports.
PR CI uses this tier and retains the existing change gates. Selected component
suites run together through the shared runner with two test-file workers. Shared
runtime or dependency changes can select several components, but do not run their
full matrices. Root `pnpm test` regressions are unchanged.

Slow includes the fast checks, additional cases, all supported test engines, and
installed-package checks. It runs only when requested. Use the **Component matrix**
manual workflow to select one component or all of them with the full browser
coverage. Manual runs of the main CI workflow use the slow tier with CI's
Chromium-only browser setting. Local commands honor `ANTA_TEST_WEBKIT=0` too.
Playwright engines do not replace checks on exact minimum shipping browsers.

To add a component, register its test files in `tests/component-suites.mjs`, import
`componentTest` and `componentEngines` from `tests/component-tier.mjs`, and use
`test.fast` for the core cases. Plain `test` belongs to the slow tier. A parameterized
case can pass `{tier: condition ? 'fast' : 'slow'}` to keep a representative import
mode in fast coverage. Keep known regressions in the fast tier when practical.
Use `componentEngines` when preparing browsers so fast checks launch only Chromium.
Add installation, exhaustive visual/property matrices, and other expensive runners
to the suite's `slow` list. Update the workflow change gates and manual selector.

Existing commands such as `pnpm test:banner` and `pnpm test:calendar` still run the
full source suite by default. `ANTA_COMPONENT_TEST_TIER=fast` selects the same core
subset when invoking a suite directly. No test cases have been removed.

## Calendar and InputDate

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:calendar` for the React/Preact
selection and form-value checks in Chromium and WebKit. This matrix is separate
from `pnpm test`. PRs run its fast tier when Calendar, InputDate, their dependencies,
the test, or CI configuration changes. Unrelated PRs skip it.

## Temporary CI exclusions

CI sets `ANTA_TEST_WEBKIT=0` to exclude WebKit engines from the autosizing,
Calendar, and production suites. It also excludes the search debounce case through
`NODE_OPTIONS=--test-skip-pattern` because that case fails during clock setup.
Other search checks and Chromium cases still run. Local commands include WebKit
and the debounce case by default.

Run either case explicitly without CI's browser and test filters:

```sh
env -u NODE_OPTIONS CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test --test-name-pattern='^debounces typing, keeps previous matches, and shows activity only in the input$' tests/search-dialog.test.mjs
# Build the production site before running this case.
env -u NODE_OPTIONS -u ANTA_TEST_WEBKIT node --test --test-name-pattern='^webkit: collapsed Playground loads safely and preserves edits after reopening$' tests/docs-build-production.mjs
```

## Panel

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test tests/panel.test.mjs` to
check viewport promotion, state requests, keyboard controls, nested ownership,
reconnection, and preservation of content, focus, selection, and scroll position.
Focus checks cover Tab wrapping, shadow controls, dynamic content, nested panels,
menus and dialogs, external focus attempts, and restoration to the opener.
Set `PANEL_TEST_BROWSER=firefox` or `PANEL_TEST_BROWSER=webkit` to run the same
suite in those engines after installing them with the site's Playwright CLI.

## Slider input

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome node --test tests/slider-input.test.mjs`
to check release outside the control, missed releases, lost pointer capture,
button combinations, cancellation, and touch dragging. `pnpm test` includes this suite.

Run `pnpm test:slider` for worker projections and the CSP source matrix, or
`pnpm test:slider:package` for the installed tarball. Slider's shared fast tier
covers both imports, default layout, numeric/form contracts, controlled
React/Preact hydration, callbacks, and drag cleanup. The slow tier adds Firefox
and WebKit, full-bundle hydration, RTL, live names, adoption, consumer shadow
roots, and package installation. The existing root pointer suite remains in
`pnpm test`.

CSP comes from actual HTTP response headers with `style-src-attr 'none'`.
`ANTA_SLIDER_CONSUMER_ROOT` selects an isolated installed consumer.
`ANTA_SLIDER_CHROMIUM_EXECUTABLE` selects an exact Chromium executable.
`ANTA_SLIDER_COMPARE_REF` opts into original appearance comparisons and PNG/metric
artifacts under `tests/.test-output/slider`. Current
engines do not establish exact minimum-browser, physical-touch-device, or manual
assistive-technology coverage. Dynamic SSR inline styles retain their separate
CSP constraint.

## Capture input

Run `pnpm run test:capture-input` from the repository root. The suite uses the site's
Playwright dependency and an in-memory build of the source, served on loopback.
It does not depend on the docs server or change a browser profile.

Install the matching browser with `pnpm --filter anta-site exec playwright install chromium`,
or use an installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm run test:capture-input`.

The suite covers opt-in behavior, serialization, nested ownership, settling,
focus, trusted mouse and touch input, pointer cancellation, touch-action,
time-based inertia, independent Capture surfaces, and shared listener cleanup. Lifecycle
and timing cases use synthetic pointer samples with a capture stub. Separate
trusted-input cases exercise the browser's native pointer capture.

## Expander

Run `pnpm test:expander` for the full CSP source matrix or
`pnpm test:expander:package` for the same checks through installed npm exports.
The component runner includes installation only in the slow tier. Core checks
cover both import modes, state requests, title interaction, focus, and hydration.
Expanded coverage includes initial variants, custom indicators, animation,
reconnection, nesting, adopted nodes, and consumer part overrides. The slow
visual matrix saves screenshots to `tests/.test-output/expander`; the manual
Component matrix workflow uploads them as an artifact. WebKit screenshots use
a separate capture context that permits Playwright's injected animation-sync
stylesheet; behavior and layout checks retain the strict CSP response headers.

Set `ANTA_EXPANDER_CHROMIUM_EXECUTABLE` to test an exact Chrome executable.
`ANTA_TEST_WEBKIT=0` selects Chromium only; otherwise Firefox and WebKit run too.
`ANTA_EXPANDER_PACKAGE_ROOT` selects an extracted package for artifact checks;
the installed-package command builds without source aliases or workspace links.

## Tooltip

Run `pnpm test:tooltip` for the source CSP matrix or
`pnpm test:tooltip:package` for the installed npm package matrix. Core PR checks
run through `pnpm test:components --tier fast --component tooltip`. Expanded
browser, visual, and installed-package coverage belongs to the slow tier.

The suite uses actual CSP response headers, including `style-src-attr 'none'`.
It covers first rendering, SSR/hydration, pointer/keyboard/touch interaction,
interactive content, placement, handoff, truncation, lifecycle cleanup,
consumer overrides, reduced motion, and both independent build load orders.
Text and Steps compose under that policy. Select and SelectFaceted retain
Input/Menu's known blocked shadow styles; those cases record the existing
violations separately and check that showing Tooltip adds none.

Set `ANTA_TOOLTIP_CHROMIUM_EXECUTABLE` for an exact Chrome executable,
`ANTA_TOOLTIP_PACKAGE_ROOT` for an extracted package, or
`ANTA_TOOLTIP_CONSUMER_ROOT` for an isolated installed consumer. Current
Playwright WebKit does not establish Safari 17.4 coverage. Screenshots from the
slow visual matrix go to `tests/.test-output/tooltip`.

## Input

Run `pnpm test:input` for Input's CSP source matrix, or
`pnpm test:input:package` for the same checks through installed npm exports.
The shared fast tier covers both import modes, React/Preact hydration, values,
selection, forms, focus, clear cancellation, and fallback autogrow. The slow tier
adds Firefox/WebKit, lifecycle and document adoption, compositions, independent
build orders, visual variants, and installed-package coverage. Existing root
Input accessibility, priority, and autosizing regressions remain in `pnpm test`.

The suite supplies CSP through response headers and asserts computed sizing.
Menu-dependent compositions record existing blocked Menu sheets separately.
Set `ANTA_INPUT_CHROMIUM_EXECUTABLE` to select an exact browser executable.
Set `ANTA_INPUT_COMPARE_ORIGINAL=1` in a checkout containing commit `56eafcdd`
to compare the source visual matrix with the original implementation.
Screenshots go to `tests/.test-output/input` and are uploaded by Component matrix.

## InputTime

Run `pnpm test:input-time` for the source CSP matrix and
`pnpm test:input-time:package` for the same checks against an installed tarball.
`pnpm test:components --tier fast --component input-time` selects core Chromium
editing, form, CSP, and React/Preact hydration checks. The slow tier adds locale,
consumer override, lifecycle, touch, visual, mixed-import, and InputDate coverage
in Chromium, Firefox, and WebKit, plus package installation.

The suite verifies HTTP CSP headers and computed styles. InputDate cases keep
Menu's existing blocked stylesheet separate. Set
`ANTA_INPUT_TIME_CHROMIUM_EXECUTABLE` for an exact browser executable, or
`ANTA_INPUT_TIME_CONSUMER_ROOT` for an installed consumer. Set
`ANTA_INPUT_TIME_COMPARE_ORIGINAL=1` to compare registered variants against
`2d2ba6e6`. Screenshots go to `tests/.test-output/input-time`.

## Toast and Toaster

Run `pnpm test:toaster` for the source CSP matrix or `pnpm test:toaster:package`
for installed-package coverage. Fast checks cover full/granular imports,
countdown restart/pause, six placements, dismissal, reconnection, and React/Preact
SSR/hydration. The slow tier adds document adoption, cleanup, nested and
interactive content, consumer overrides, motion, independent build orders,
visual comparisons, and the installed consumer.

The server supplies real CSP response headers, including `style-src-attr 'none'`.
Set `ANTA_TOASTER_CHROMIUM_EXECUTABLE` for an exact browser executable.
Set `ANTA_TOASTER_COMPARE_ORIGINAL=1` in a checkout containing `2d2ba6e6` to
compare the visual matrix with the original implementation. Screenshots and
metrics go to `tests/.test-output/toaster`. Screenshot contexts permit
the capture tool's injected stylesheet; behavioral pages retain strict CSP.
Independent package entries keep their existing module-local default managers;
the mixed-build checks pass an explicit shared store.

## Copy

Run `pnpm test:copy` for the feedback CSP matrix, or `pnpm test:copy:package`
for the same checks through an isolated installed npm package. The shared fast
tier covers both import modes, authored markup, pointer/keyboard activation,
request/result callbacks, React/Preact SSR/hydration, missing-CSS recovery, async
ownership, and blocked controls. Slow adds feedback lifetimes and the icon
success/failure/reset matrix, browser engines, lifecycle/adoption, nested
ownership, compositions, clipboard sources/formats, mixed imports, visuals,
and installation.
The existing root feedback-placement and code-copy regressions remain in `pnpm test`.

The suite supplies actual CSP response headers, including `style-src-attr 'none'`.
Menu compositions record Menu's existing blocked shadow sheets and assert that
Copy adds no violations. Reduced-motion tests preserve the original rise/fade.
Set `ANTA_COPY_COMPARE_ORIGINAL=1` to compare geometry and sampled motion against
`2d2ba6e6` and check both old/new element import orders. The original fixture uses
its matching clipboard helper. Visual artifacts go to `tests/.test-output/copy`;
capture pages permit the screenshot tool's synchronization stylesheet while
behavioral pages retain CSP.
Set `ANTA_COPY_CHROMIUM_EXECUTABLE` for an exact Chrome executable or
`ANTA_COPY_CONSUMER_ROOT` for an isolated installed package. Current Playwright
WebKit does not establish Safari 17.4 coverage.

## Menu

Run `pnpm test:menu` for the source CSP matrix or `pnpm test:menu:package` for
an isolated tarball installation. The shared fast tier covers full/granular
imports, raw ownership and state requests, React/Preact hydration, and independent
document coordination. Expanded keyboard, touch, placement, scrolling, lifecycle,
composition, visual, and installed-package coverage belongs to the slow tier.
The server supplies real CSP response headers, including `style-src-attr 'none'`.

Set `ANTA_MENU_CHROMIUM_EXECUTABLE` for an exact browser executable,
`ANTA_MENU_CONSUMER_ROOT` for an installed consumer, and
`ANTA_MENU_COMPARE_ORIGINAL=1` to compare against `aeea7c08`. Screenshots and
computed metrics go to `tests/.test-output/menu`. RTL comparisons explicitly
record the original opposite-inset overflow and assert the corrected position.
Playwright WebKit does not establish shipping Safari 17.4 coverage.

## Select

Run `pnpm test:select` for focused option-projection and CSP browser checks, or
`pnpm test:select:package` for the browser cases through an installed tarball.
The shared fast tier covers single-pass custom filtering, typed selection and
bulk changes, worker projections, React/Preact hydration and controlled updates,
keyboard filtering, and SelectFaceted's independent facet values and searches.
The slow tier adds full-bundle hydration, nested option navigation, all browser
engines, and installed-package checks. Existing Input accessibility and Menu
trigger-replacement tests remain in their respective suites.

The server supplies actual CSP response headers, including
`style-src-attr 'none'`. Hydration fixtures use explicit option tooltips so their
server/client text is independent of the existing platform-specific isolate
hint. Consumer styles, custom color/radius props, and MenuItem's custom-indicator
layout wrapper retain their separate inline-style constraints.
For a one-off appearance comparison, set `ANTA_SELECT_COMPARE_REF` to an
available Git ref. This explicitly compares six trigger variants per import
mode and browser to that ref, and can fail for intentional appearance changes.
Regular fast, slow, and manual runs need no historical Select commit. Paired
screenshots and metrics go to `tests/.test-output/select`. The manual Component
matrix exposes the same opt-in through `select_compare_ref` and saves its artifacts.
## Dialog

Run `pnpm test:dialog` for the source CSP matrix or `pnpm test:dialog:package`
for an isolated installed tarball. The shared fast tier covers both import modes,
raw modal behavior, controlled state, Escape/cancel and native close, focus return,
React/Preact SSR/hydration, CSS loading, document listener cleanup, and optional
header/footer regions following slot assignment through off-DOM states without
extra attributes or part tokens. Close clearance uses host `:has()`; Firefox may
retain stale padding after changing an existing child into or out of the close
slot. That clearance-only limitation is accepted.
The slow tier adds expanded engines, pointer drags and cancellation, nested focus,
scrolling, consumer overrides, reduced motion, reconnects, mixed builds,
visual comparisons, and installed-package checks.

Header-name regressions include in-place text edits after hydration, replaced
headers, disconnect/reconnect, and document adoption. Observation reads assigned
header content only and stops on disconnection. The slow matrix also checks
external CSS loaded inside a consumer shadow root.
Core fallback cases replace open/modal selectors with an unsupported pseudo-class in
the served CSS, including feature queries. They verify visible, editable modals,
static backdrop tint, Escape and close-control dismissal, and focus restoration
under strict CSP. Stubbing JavaScript `CSS.supports` does not exercise CSS queries.
Native non-modal opening is checked with and without `:open` support. Surface
motion requires `:open`; older engines retain visible static surfaces and their
modal layout. The public Anta `show()` method continues to open a modal.

Behavioral pages use real CSP response headers including `style-src-attr 'none'`.
Set `ANTA_DIALOG_CHROMIUM_EXECUTABLE` for an exact Chrome executable or
`ANTA_DIALOG_CONSUMER_ROOT` for an installed consumer. Set
`ANTA_DIALOG_COMPARE_ORIGINAL=1` to compare the registered implementation at
`aeea7c08`. Screenshots and metrics go to `tests/.test-output/dialog`.
WebKit capture uses a separate page that permits the screenshot tool's stylesheet;
behavior and computed-style checks retain strict CSP. Playwright WebKit does not
establish shipping Safari 17.4 coverage. Existing native discrete exit support
varies by engine; compare it with the original rather than asserting a new fallback.

## InputAutocomplete

Run `pnpm test:input-autocomplete` for worker projections, public types, and the
React/Preact browser suite, or `pnpm test:input-autocomplete:package` for types
and browser checks against an isolated installed tarball. The shared runner
selects core checks with `--tier fast --component input-autocomplete`.
Expanded engines, full-bundle hydration, and installation stay in the slow tier.

The suite uses actual CSP response headers with `style-src-attr 'none'` and
both element import modes. It covers callback composition and cancellation,
controlled empty text, parent resets, rejected and accepted suggestion choices,
clear and form reset, changing results, disabled rows, IME keyboard probes,
pointer focus, naming, and active-option relationships. It reuses Input's native
field and Menu's existing navigation; ordinary Input value-rejection and
implicit-submit behavior are outside this refactor. Synthetic composition keys
provide engine evidence, not an operating-system IME or assistive-technology run.

## Selection value inputs

Run `pnpm test:selection` for Calendar, RadioGroup, and Tabs value ownership,
React/Preact SSR hydration, control release, empty-string options, property
assignments before registration, and unchanged uncontrolled attributes. The
source matrix runs Chrome, Firefox, and WebKit; the shared fast tier runs core
checks in Chrome. `pnpm test:selection:package` runs the matrix through an
isolated installed tarball. Calendar/InputDate's existing round-trip and form
regressions remain in `pnpm test:calendar`.

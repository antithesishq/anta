# Regression tests

Run `pnpm test` for general root regressions, including Markdown disclosure conversion.
CI uses the runner's installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome`.

## Calendar and InputDate

Run `CAPTURE_TEST_BROWSER_CHANNEL=chrome pnpm test:calendar` for the React/Preact
selection and form-value checks in Chromium and WebKit. This matrix is separate
from `pnpm test`. CI runs it when Calendar, InputDate, their dependencies, the test,
or CI configuration changes, and on manual CI runs. Unrelated PRs skip it.

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

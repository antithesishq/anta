# Regression tests

Run `pnpm test` for all root tests, including Markdown disclosure conversion.
CI uses the runner's installed Chrome with `CAPTURE_TEST_BROWSER_CHANNEL=chrome`.

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

# Box input regression tests

Run `pnpm run test:box-input` from the repository root. The suite uses the site's
Playwright dependency and an in-memory build of the source, served on loopback.
It does not depend on the docs server or change a browser profile.

Install the matching browser with `pnpm --filter anta-site exec playwright install chromium`,
or use an installed Chrome with `BOX_TEST_BROWSER_CHANNEL=chrome pnpm run test:box-input`.

The suite covers opt-in behavior, serialization, nested ownership, settling,
focus, trusted mouse and touch input, pointer cancellation, touch-action,
time-based inertia, independent Boxes, and shared listener cleanup. Lifecycle
and timing cases use synthetic pointer samples with a capture stub. Separate
trusted-input cases exercise the browser's native pointer capture.

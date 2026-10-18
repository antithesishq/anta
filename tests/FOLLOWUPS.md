# Testing follow-ups

Use [the test guide](README.md) for current commands and
[CI](../.github/workflows/ci.yml) for automated coverage. Keep this list focused
on work that remains after the historical test-cost review.

## Restore excluded coverage

- Fix the clock setup in [the search dialog test](search-dialog.test.mjs).
  Install a deterministic clock before application timers start and advance it
  explicitly. Restore the excluded debounce case only after it passes reliably.
  Preserve cancellation, stale-response, and search interaction coverage.
- Investigate the WebKit Playground stall in
  [production checks](docs-build-production.mjs) before enabling WebKit in CI.
  Bound test and cleanup operations. Keep the Safari crash regression and use
  [the manual commands](component-matrices.md#temporary-ci-exclusions) to verify
  the excluded cases.

## Review low-value assertions

- Review the native span CSSOM probe in [Avatar CSP tests](avatar-csp.test.mjs).
  Retain the cases that exercise actual Avatar rendering under CSP.
- Review default palette and radius literals in [theme tests](themes.test.mjs).
  Preserve explicit overrides, theme switching, and packaged font behavior.
- Review source-shape assertions in [comparison tests](comparison.test.mjs) and
  exact code/preview adjacency in [preview tests](docs-previews.test.mjs).
  Preserve source attribution, data integrity, accessibility, and working demos.

## Extend automated coverage

Evaluate bounded scheduled runs for expanded engine and visual matrices,
production navigation, saved consumer fixtures, and property-test campaigns.
Save failure details and available artifacts when checks fail or time out.
Keep fast PR checks focused on relevant package, state, interaction, and
accessibility regressions. The current manual runners remain available.

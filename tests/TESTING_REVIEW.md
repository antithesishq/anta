# Review recent test costs

Recent PRs lose time to a stalled WebKit Playground regression and a recurring
search-test clock error. Remove the stalled test from the PR gate first. Preserve
its coverage for a bounded manual or nightly run, and delete checks that only
freeze presentation details or test browser behavior outside Anta.

Reviewed October 11, 2026: PRs #203–#217, with #202 as context for consumer checks.
Source baseline: `origin/main` at `9beec434`. Open PR changes were reviewed through
their diffs, descriptions, and CI logs. CI now excludes the WebKit Playground
case and the search debounce case through exact-name filters. Both remain
available locally. The other deletion and nightly recommendations remain proposals.

## CI timeouts

The following durations come from GitHub job steps, excluding queue time.

| PR and run | Root tests | Install WebKit | Production tests | Result |
| --- | ---: | ---: | ---: | --- |
| [#206 before #207](https://github.com/antithesishq/anta/actions/runs/37556851943) | 74 s | Absent | 13 s | Passed in about 3 minutes overall |
| [#207](https://github.com/antithesishq/anta/actions/runs/37567306187) | 115 s | 62 s | 5 h 56 m 34 s | Cancelled |
| [#205 after merging #207](https://github.com/antithesishq/anta/actions/runs/37629759320) | 89 s | 48 s | 5 h 57 m 34 s | Cancelled |
| [#213](https://github.com/antithesishq/anta/actions/runs/37840179006) | 109 s | 35 s | 5 h 57 m 33 s | Cancelled |
| [#211](https://github.com/antithesishq/anta/actions/runs/37933876618) | 88 s | 44 s | 5 h 57 m 32 s | Cancelled |
| [#206 latest](https://github.com/antithesishq/anta/actions/runs/37966778897) | 74 s | 34 s | 5 h 58 m 2 s | Cancelled |
| [#216 latest](https://github.com/antithesishq/anta/actions/runs/37987554063) | 96 s | 54 s | 5 h 56 m 26 s | Cancelled |
| [#217 latest](https://github.com/antithesishq/anta/actions/runs/38158029280) | 108 s | 39 s | Skipped | Search-test clock error |

The sampled 60-run history contains 21 completed cancellations since #207's first
run, across 10 branches. Each lasted approximately six hours. The checked job
records put the long delay in **Test production site**. Small theme PRs inherit
the same failing gate without adding tests of their own.

### WebKit Playground stalls

[PR #207](https://github.com/antithesishq/anta/pull/207) added WebKit installation,
six root autosizing cases, and four production browser cases. In both its final
run and #216's latest run, production output ends in the same order:

1. Collection stylesheet check passes.
2. Chromium facet-chip check passes.
3. Chromium collapsed-Playground check passes.
4. WebKit facet-chip check passes.
5. No result arrives for the next case, WebKit's collapsed-Playground check.
6. GitHub cancels the job approximately six hours after it started.

The next case is defined at [docs-build-production.mjs](docs-build-production.mjs#L78).
It combines editor initialization, compilation, retained edits, client navigation,
nested disclosures, and iframe rendering. Chromium completes it in 6–8 seconds
in these runs. The logs localize the stall to the WebKit case or its cleanup;
they do not identify the particular browser operation that stops responding.

The helper sets a 20-second Playwright page timeout, but the Node tests have no
test deadline and [ci.yml](../.github/workflows/ci.yml) has no job or step deadline.
A page timeout does not bound every awaited operation or browser cleanup. Moving
this test to nightly unchanged would carry the same six-hour failure with it.

CI now excludes this WebKit production case and retains the Chromium case. The
WebKit case remains available through an explicit manual command documented in
[Regression tests](README.md#temporary-ci-exclusions). Add a process or step
deadline before restoring it to automated runs. Preserve the Safari crash
regression because it covers a real failure.

### Search debounce fails in the harness

The [#216 run](https://github.com/antithesishq/anta/actions/runs/37985109781) and
[#217 run](https://github.com/antithesishq/anta/actions/runs/38158029280) both fail
`debounces typing, keeps previous matches, and shows activity only in the input`
with `clock.pauseAt: Error: Cannot fast-forward to the past`. Their other root
tests pass: 306/307 and 312/313 respectively.

[search-dialog.test.mjs](search-dialog.test.mjs#L129) installs the browser clock
during setup, then calls `page.clock.pauseAt(new Date())` after asynchronous
setup. It passes host time to an already advancing browser clock. The observed
failure occurs before the debounce assertions.

CI now excludes this case by name. The remaining search cases still run. Before
restoring the excluded case, rewrite the clock setup to use one deterministic
time before application timers start, and advance it explicitly. Keep debounce,
cancellation, and stale-result coverage. Moving the entire search suite or
repeatedly rerunning CI would also move or repeat the harness error.

## Delete candidates

These reduce maintenance work. Their runtime savings are small relative to the
WebKit stall.

| Candidate | Reason | Coverage to preserve |
| --- | --- | --- |
| `direct style.display assignments remain allowed under style-src self`, [avatar-csp.test.mjs](avatar-csp.test.mjs#L155) | This #202 investigation probe tests a native span and the browser's CSSOM policy. It never exercises Avatar. | The three Avatar CSP cases cover rendered images, generated avatars, rounding, and badges. |
| Literal palette seeds and default radius expectations inside `Antithesis shapes and seeds...`, [themes.test.mjs](themes.test.mjs#L290) | An intentional Tag change from 1 px to 3 px failed [#215](https://github.com/antithesishq/anta/actions/runs/37959186193), although that PR adds fuzz fixtures. PR #206 then changed the expected value. | Explicit `round` overrides, working theme changes, and published themes making no font requests. Remove presentation literals selectively rather than the whole test. |
| Source-expression and exact markup checks, [comparison.test.mjs](comparison.test.mjs#L12) and [header checks](comparison.test.mjs#L37) | Requiring `COVERAGE_SYSTEMS.map(...)`, exact header markup, and two `<small>` blocks binds editorial changes to one implementation. | Source attribution/data integrity checks and a small rendered accessibility smoke check if maintained. |
| Exact preview/code adjacency check, [docs-previews.test.mjs](docs-previews.test.mjs#L15) | This enforces a prose/layout convention already documented in the repo. It does not establish that the demos work. | Browser behavior for the examples can remain in occasional site validation. |

Keep assertions that expose actual packaging, state, or accessibility regressions.
For example, #202's [package-css.test.mjs](package-css.test.mjs) catches missing CSS
exports and accidental browser/CSS imports in the worker-facing API. It bundles
small inputs without launching browsers and should remain in PR checks.

## Nightly candidates

The following is a proposed allocation for later work. No schedule is enabled.

| Coverage | Proposed home | PR coverage |
| --- | --- | --- |
| WebKit production Playground and facet-chip cases in `docs-build-production.mjs` | Bounded manual run now, nightly after the stall is isolated | Chromium Playground smoke when site runtime changes |
| WebKit autosizing cases in `input-autosizing.test.mjs`, including #217's expanded browser identities | Nightly engine matrix, plus explicit runs for Input changes | One focused grow/shrink and scroll-preservation regression in Chromium |
| Full production navigation, theme/iframe synchronization, demo layout, and `docs-previews.test.mjs` | Nightly site suite | Relevant smoke cases when the build or site runtime changes |
| Broad theme, tone, size, and viewport matrices in themes, Tabs, Title, and comparison tests | Nightly or targeted visual review | State changes, explicit overrides, and keyboard behavior |
| Saved Next.js and Preact tarball fixtures | Nightly or release validation | Cheap export, import, and bundle checks |
| Button property harness and #215's stateful fuzz campaigns | Bounded nightly campaigns with saved failure details | Replay a known failing case when changing its component |
| Plot browser interactions and viewport matrices | Nightly or targeted Plot validation | Focused interaction math and package contracts |

Consumers already run only through `test:consumers` or the manually triggered
[consumer-validation.yml](../.github/workflows/consumer-validation.yml). The
Button harness is separate from `pnpm test`. #215's Bombadil campaigns are also
manual. They do not explain current PR timeouts and do not need deletion to
speed up CI. Plot's individual test scripts are not called by regular CI;
`check:package` is called and took 5–6 seconds in sampled runs.

Retain fast Markdown/content-catalog tests, package contracts, and focused
component interaction checks in PR CI. Search sanitization, explicit AI request
behavior, stale-response cancellation, and essential keyboard/focus regressions
should have deterministic PR coverage.

## Recent PR coverage

| PR | Test changes or validation burden | Proposed treatment |
| --- | --- | --- |
| [#203](https://github.com/antithesishq/anta/pull/203) | No test edits; description lists full package, site, worker, and production validation for a theme change. | Scoped theme checks and visual review; broad matrices later. |
| [#204](https://github.com/antithesishq/anta/pull/204) | No test edits; manual viewport/theme matrix for the site shell. | Keep targeted layout review. |
| [#205](https://github.com/antithesishq/anta/pull/205) | Adds Plot interaction-target tests and expands browser tests. | Keep focused interaction tests; browser matrix later. |
| [#206](https://github.com/antithesishq/anta/pull/206) | Updates two existing shape expectations; inherits the WebKit stall. | Remove fixed design literals selectively. |
| [#207](https://github.com/antithesishq/anta/pull/207) | Adds WebKit to CI and the stalled production case. | First priority for removal from the PR gate. |
| [#208](https://github.com/antithesishq/anta/pull/208) | Updates existing Select/accessibility/menu and consumer fixtures; reports six cases unavailable without WebKit. | Keep functional/accessibility coverage; optional engine checks later. |
| [#209](https://github.com/antithesishq/anta/pull/209) | No test edits; intentional Tag radius change conflicts with an existing assertion. | Stop freezing default visual literals. |
| [#210](https://github.com/antithesishq/anta/pull/210) | No test edits; manual Chromium/WebKit focus-ring checks. | One visual check per affected state; engine matrix later. |
| [#211](https://github.com/antithesishq/anta/pull/211) | No test edits; manually checks 48 Switch color states. | Preserve functional checks; broad color matrix later. |
| [#212](https://github.com/antithesishq/anta/pull/212) | No test edits; fixes controlled Calendar state. | A focused state regression has value in PR CI. |
| [#213](https://github.com/antithesishq/anta/pull/213) | No test edits; visual checkbox glyph change inherits the stall. | Targeted visual review. |
| [#214](https://github.com/antithesishq/anta/pull/214) | No test edits; Tag color fix inherits the stall. | Targeted visual review. |
| [#215](https://github.com/antithesishq/anta/pull/215) | Adds seven manual fuzz fixtures; CI fails on the unrelated Tag-radius literal. | Keep campaigns outside PR CI and save known failures. |
| [#216](https://github.com/antithesishq/anta/pull/216) | Expands existing Tabs color checks; reports a search flake and repeatedly reaches the WebKit stall. | Keep Tabs behavior checks; matrix later; fix or temporarily exclude the failing search case. |
| [#217](https://github.com/antithesishq/anta/pull/217) | Adds six cases to the existing autosizing suite; latest CI fails on the same search clock error. | Focused sizing regression on PRs; full engine/identity matrix later. |

## Remaining work

1. Add short CI step/job deadlines and cancel superseded runs on the same PR.
   The stalled WebKit production case is already excluded by name.
2. Repair the excluded search debounce case before restoring it. Delete the
   native CSSOM probe and selected presentation/source-shape assertions.
3. Define explicit fast and extended test commands, then move extended browser
   coverage to bounded nightly jobs. Save logs and failure artifacts even when a
   campaign times out. Retain targeted commands for component changes.
4. Narrow agent verification guidance: run the affected tests once, reuse current
   build output, and rerun after relevant changes or actual failures. Reserve
   complete validation for broad changes. Reuse the saved consumer fixtures;
   fresh framework scaffolds should serve onboarding/package investigations.

The PR descriptions show extensive manual validation but do not measure agent
time. CI timings establish the automated delay. Local builds and browser matrices
are additional candidates for reducing repeated work, without a measured saving
attached to them.

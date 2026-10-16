# CSP and shadow styling audit

Recorded October 5, 2026 against commit `f4255b8` on
`fix/granular-element-css`, with the package version set to `0.3.34`.
The current checklist tracks subsequent work. The sections after it retain the
October 5 research snapshot and migration proposal, including historical
constraints that may have changed.

## Current refactor checklist

Updated October 15, 2026 on `codex/input-time-external-css`.

Move default styling into external CSS and use declarative light DOM where it
simplifies initial rendering. Decide the DOM structure and ownership separately
for each component before implementation. JSX owns the markup and attributes it
renders, including ARIA; raw HTML authors supply the equivalent markup. An
element must not rewrite application-owned light DOM or host attributes.

Completed work:

- [x] [Avatar](src/elements/a-avatar.ts): external part styling; retains shadow DOM.
- [x] [Text](src/elements/a-text.ts): light-DOM content and Button control;
  automatic measurement and expansion, external CSS, and off-DOM state/ARIA.
- [x] [Card](src/components/Card.tsx): CSS-only light DOM, declarative regions,
  and a native anchor for link mode. No element class or injected stylesheet.
- [x] [Progress](src/components/Progress.tsx): CSS-only light DOM with a
  `::before` indicator. Numeric CSS variables override `value` and `max`
  attribute fallbacks; JSX owns variables, markup, and ARIA. Raw authors keep
  values and ARIA in sync. Native `<progress data-anta>` shares the stylesheet
  and entry while retaining browser-owned rendering and semantics. No shadow
  root, registration, indicator child, or fallback slot.

Panel stays outside this refactor and retains its current implementation.

The following is the proposed order. Each item includes research, implementation,
and verification before moving to the next component.

1. [x] [Banner](src/elements/a-banner.ts): light-DOM regions and external CSS
   implemented. Visibility remains in ElementInternals; JSX omits absent actions
   and CSS hides empty regions. No content observers or DOM rewriting.
   Dismissal transitions retained. Source, installed-package, minimum Chrome,
   original-layout, and production checks passed; coverage limits are below.
2. [x] [Expander](src/elements/a-expander.ts): named authored regions with
   manual shadow projection. The owned native button and inert collapse region
   remain; all defaults are external part rules. Raw `level` belongs to the
   summary. No public slot aliases, fallback markup, injected styles, or authored
   DOM rewriting. The 200ms collapse and indicator motion remain. Reconnection
   retains applied state. Source, installed-package, visual, minimum Chrome,
   and production checks passed; coverage limits are below.
3. [x] [Tooltip](src/elements/a-tooltip.ts): existing manual-popover container
   and styled bubble slot retained. Defaults use external `container` and
   `bubble` part rules. Positioning, interaction, proximity, and timers stay in
   the element; coordination and observation belong to the connected document.
   No injected stylesheet or authored host/light-DOM rewriting.
4. [x] [Input](src/elements/a-input.ts): external defaults implemented for the
   existing input, textarea, button, and slots. Source, installed-package,
   visual, form, and hydration checks pass in current engines. Chrome 135's
   native number buttons are an accepted difference; see Input verification.
5. [x] [InputTime](src/elements/a-input-time.ts): external defaults for the owned
   native segments, separators, field, and slots. Locale layout and value/event
   contracts remain. JSX owns CSS-only slot groups; readonly and cancelable clear
   actions follow Input. Source, installed-package, minimum Chrome, original
   layout, and production checks pass; coverage limits are below.
6. [ ] [Menu](src/elements/a-menu.ts): popover surface, header/footer,
   scrolling, keyboard navigation, and focus ownership. Verify with Input.
7. [ ] [Dialog](src/elements/a-dialog.ts): modal structure, optional regions,
   backdrop, focus management, and close behavior.
8. [ ] [Slider](src/elements/a-slider.ts): rail, thumbs, scalar/range values,
   markers, affixes, dragging, and focus states.
9. [ ] [Toast](src/elements/a-toast.ts): content, entry/exit animations, and
   countdown pause, restart, and dismissal.
10. [ ] [Toaster](src/elements/a-toaster.ts): placement regions and pointer
    handling. Verify together with Toast.
11. [ ] [Copy feedback](src/elements/a-copy.ts): feedback popover, placement,
    measuring/showing states, and animation.

After their underlying elements are migrated, verify these compositions:

- [ ] ButtonCopy and MenuItemCopy: Copy feedback and Menu.
- [ ] Breadcrumbs: collapsed Menu and Copy feedback.
- [x] Steps: Tooltip hints, including clipped labels and hints.
- [ ] InputDate and InputAutocomplete: Input and Menu.
- [ ] Select and SelectFaceted: Input, Menu, and optional Tooltip.

For each migration, verify appearance before JavaScript initializes,
SSR/hydration, keyboard and pointer interaction, accessible names, nested
composition, and consumer CSS overrides. Check full and granular imports under
an actual CSP response header. Custom values serialized into `style` attributes
remain a separate constraint; completing the stylesheet checklist does not make
every dynamic JSX prop compatible with `style-src-attr 'none'`.

### Banner verification

Verified October 14, 2026:

- `pnpm test:banner`: 55 source checks passed in Chrome `155.0.8059.40`,
  Firefox `155.0`, and Playwright WebKit `26.6`. The same 55 checks passed against
  an extracted npm tarball made with `npm pack --ignore-scripts`.
- The packed suite passed 19 checks in Chrome for Testing `135.0.7049.114`,
  the supported minimum major version. Set `ANTA_BANNER_CHROMIUM_EXECUTABLE`
  to a browser executable and `ANTA_TEST_WEBKIT=0` to repeat that check.
  `ANTA_BANNER_PACKAGE_ROOT` selects the extracted package directory.
- CSP was supplied as an HTTP response header with same-origin scripts and
  styles, `style-src-attr 'none'`, and data images allowed for Icon masks. No CSP
  violations occurred. Coverage includes initial rendering, SSR/hydration,
  keyboard and pointer dismissal, cancellation, controlled rejection/restoration,
  nesting, empty regions, reduced motion, overrides, and both mixed import orders.
- Compared the original Banner at `84ae9fff` after registration with the new
  layout: start, center, RTL, round, wrapped, no actions, and no close control.
  Host and content geometry matched exactly in all three engines, across 21
  comparisons. Screenshots retained the original appearance; dismissal timings
  and the transition declarations were preserved.
- The production site built successfully and passed all 10 production checks.
  The Banner page's controlled and raw demonstrations also passed interaction
  checks in Chrome and WebKit, including rejecting dismissal and showing it again.
- Root regressions passed all 325 checks selected by the existing CI command.
  The unfiltered run passed 325 of 326; the debounce-clock case failed with
  `Cannot fast-forward to the past`, matching CI's existing exclusion.
  Anta lint/type checking, sticker type checking, and site CSS lint passed.
- PR review found that the close-request path used the current document's
  `Element` constructor, which rejected a Banner adopted from another document.
  A realm-independent node/tag check fixes that regression. The expanded suite
  passed 61 source checks and 61 packed-artifact checks in all three engines,
  including six same-origin iframe cases covering dismissal, nested isolation,
  unchanged markup, and CSP. The earlier minimum Chrome run covered 19 checks
  before these adoption cases were added.
- The SSR and package follow-up passed all 73 source checks and all 73
  installed-package checks in the same three engines. `pnpm test:banner:package`
  installs an npm tarball in an isolated consumer and resolves public package
  exports, including granular entries, the full bundle, and their stylesheets.
  Builds use the installed package without Anta source aliases or workspace links.
  React and Preact each generate their own server HTML. Hydration preserves the
  server-rendered nodes and reports no React recovery errors. Initially controlled
  closed banners hydrate, reopen, reject dismissal, and accept it in both import
  modes. The installed consumer uses React/React DOM `19.3.0`, Preact `10.29.8`,
  and `preact-render-to-string` `6.7.0`. PR CI selects core source checks through
  the shared fast tier. Full source and installed-package matrices remain in the
  slow tier for manual runs.
- The shared tier split passed 44 core checks across Banner, Calendar/InputDate,
  Card, Progress, and Text in about 16 seconds locally. Full coverage passed all
  218 source checks and 73 installed Banner checks. Tier selection regressions,
  Anta lint, and workflow YAML parsing also passed.

Exact Firefox `136` and Safari/iOS Safari `17.4` were not executed. Their
required custom-state APIs are covered by the
[MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/CustomStateSet.json)
and [Safari 17.4 release notes](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/).
The existing display and intrinsic-size transitions remain progressive
enhancements; this refactor adds no animation fallback or newer baseline API.
Current Playwright WebKit is engine evidence, not a shipping Safari 17.4 run.

### Expander verification

Verified October 14, 2026:

- `pnpm test:expander` passed all 85 source checks in Chrome `155.0.8059.40`,
  Firefox `155.0`, and Playwright WebKit `26.6`.
- `pnpm test:expander:package` passed the same 85 checks through an npm tarball
  installed in an isolated consumer. Builds resolve public granular and full
  bundle exports without Anta source aliases or workspace links. React/React DOM
  `19.3.0`, Preact `10.29.8`, and `preact-render-to-string` `6.7.0` each generate
  their own SSR output; hydration retains nodes without React recovery errors.
- The installed suite passed all 29 checks in Chrome for Testing
  `135.0.7049.114`. Set `ANTA_EXPANDER_CHROMIUM_EXECUTABLE` to select an exact
  executable and `ANTA_TEST_WEBKIT=0` for the Chromium-only run.
- Behavior and layout checks use actual CSP response headers with same-origin
  scripts/styles, `style-src-attr 'none'`, and data images for masks. No component
  CSP violations occurred. Coverage includes initial controlled/uncontrolled
  visibility, pointer/keyboard activation, actions, interactive title children,
  selection, cancellation, controlled rejection/restoration, handoff,
  reconnection, nesting, empty regions, adopted nodes, accessible names,
  collapsed focus exclusion, reduced motion, overrides, and both mixed import
  orders. Chrome's native accessibility tree excludes collapsed body links.
- Compared the registered original at `f263d70a` with the refactor across 19
  variants in initial and open states. All 114 geometry comparisons matched in
  Chrome, Firefox, and WebKit. Screenshots retain the original appearance,
  including start/end placement, RTL, custom titles, pairs, actions, levels,
  round, outdent, and disabled-open sections.
- The reusable slow visual matrix checks 19 variants before/after upgrade,
  captures closed/open screenshots, and verifies native `details[data-anta]`.
  Screenshots go to `tests/.test-output/expander` and the manual Component matrix
  workflow uploads them. WebKit's Playwright screenshot helper injects an
  animation-sync stylesheet; WebKit captures use a separate context that permits
  that tool action. Original behavior/layout pages retain strict CSP enforcement.
- Review regressions cover short, wrapped, and rich titles beside 60px actions,
  plus initially open plus indicators at both placements with `state` and
  `default-state`. They reproduce the original failures and pass through granular
  and full bundle imports under CSP. All 16 Expander fast-tier checks passed.
  The CI gate also selects Expander for an isolated `key-activation.ts` change.
  Production Chrome and WebKit checks confirmed the historic `#indicator` and
  `#round` documentation fragments still resolve to their sections.
- Built-in and custom artwork now share the authored `a-expander-indicator`.
  Built-ins select `shape`; sibling order selects start/end placement. There is
  no shadow glyph, initial-render fallback artwork, or host indicator/placement
  alias. The existing indicator part retains color and rotation overrides.
  React and Preact preserve indicator nodes, including pairs, when JSX changes
  placement. Nested indicators retain independent applied state. The 150ms
  indicator transition and plus bar both stop under reduced motion; the override
  follows the drawing rules so their cascade order cannot restore animation.
- The original 200ms grid transition and 150ms indicator motion remain. A stepped
  keyframe animates an inherited host value to keep content clipped until the
  row finishes expanding, then restores visible overflow. Discrete overflow
  transitions through `::part()` revealed content at zero height, and document
  keyframes directly on the part still failed in Chrome 135. The timing test
  samples the start, middle, and end, interrupts closing with reopening, and
  verifies immediate opening under reduced motion in granular and full builds.
  Applied state continues to read the owned button's ARIA,
  keeping custom-state query behavior out of the interaction algorithm. The new
  title-focus guard prevents Chromium's native summary activation for Space in
  a projected input.
- The shared fast tier passed all 52 selected checks across registered components.
  PR CI selects Expander core regressions; expanded browser, visual, and installed
  matrices stay in the slow tier. The production site built and all 10 production
  checks passed. Expander's production demonstrations passed in Chrome and WebKit,
  including controlled rejection and reopening. All 313 selected root regressions,
  Anta lint/type checks, sticker type checks, and site CSS lint passed.

Exact Edge `135`, Firefox `136`, and Safari/iOS Safari `17.4` were not executed.
Chrome 135 provides minimum Chromium evidence; current Playwright WebKit is
engine evidence, not a shipping Safari 17.4 run. Manual slot assignment is
supported before these minimum versions, according to
[MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLSlotElement.json)
and the [Safari 16.4 release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/).
Custom-state styling support is recorded in the Banner verification above.
The movement still uses the original grid transition; clipping uses standard
CSS keyframes and an inherited custom property.

### Tooltip verification

Verified October 14, 2026:

- All 107 source checks and 107 installed-package checks passed in Chrome `155.0.8059.40`, Firefox `155.0`, and
  Playwright WebKit `26.6`. Source and installed-package results include React
  and Preact's own SSR output, node-preserving hydration, full and granular
  imports, and both independent build orders. Installed builds resolve npm
  exports from an isolated tarball installation without source aliases or
  workspace links.
- CSP comes from HTTP response headers: same-origin scripts/styles,
  `style-src-attr 'none'`, and data images for masks. Tooltip's strict cases
  produce no violations. Coverage includes pre-upgrade hiding, initial position,
  pointer and keyboard opening, Escape, touch hold/tap/drag/scroll cancellation,
  trusted Chromium touch, interactive pointer/focus travel, clipping and
  viewport flipping, content changes, truncation, explicit-tooltip precedence,
  nesting, reconnection, adoption, and independent document coordination.
- The native popover and bubble retain separate 150ms lifecycle and 60ms
  proximity transitions. Paused browser transitions verify independent computed
  opacity at intermediate times. External normal part rules outrank shadow-inline
  declarations, so the default bubble rule leaves runtime-owned opacity unset.
  The far-pointer cutoff uses element-owned state. Reduced motion removes both
  transitions; initial positioning completes before the first visible paint.
- Compared the registered original at `0c6c30c6` with the refactor across 10
  variants in three engines. All 30 geometry, typography, and appearance
  comparisons matched, including rich/wrapped content, top/left placement,
  round, interactive content, RTL, dark mode, and consumer overrides. The slow
  suite captures six variants per import mode and engine. Screenshots live in
  `tests/.test-output/tooltip`; WebKit capture uses a separate context that
  permits Playwright's animation-sync sheet. Behavior tests retain strict CSP.
- Text's automatic tooltip and Steps' clipped hints compose under strict CSP.
  Select and SelectFaceted retain Input/Menu's existing blocked shadow sheets;
  their cases record that baseline and verify Tooltip introduces no additional
  violation. Mixed-build tests also verify Input's native popup references and
  authored accessible name when Input and Menu come from separate builds.
- Accessible descriptions remain authored. Chromium's accessibility tree verifies
  `aria-description` before and after opening. Referencing the Tooltip host with
  `aria-describedby` alone did not expose a closed popover's description, so the
  documentation uses a persistent authored description. Interactive content
  retains its existing semantics; it is not presented as the conventional
  nonfocusable ARIA tooltip pattern.
- All five saved production consumer fixtures passed: Next.js full/granular and
  Preact full/basic-granular/composed-granular. All 320 selected root regressions
  passed with CI's existing debounce exclusion. Anta lint/type checking, sticker
  type checking, site CSS lint, tier selection, the production build under Node
  `24.15.0`, and all 10 production checks passed. The shared fast tier passed all
  85 selected checks. PR CI selects Tooltip core regressions; expanded browser,
  visual, and installed-package matrices stay in the slow tier.

All 39 installed-package checks passed in Chrome for Testing `135.0.7049.114`.
Exact Edge `135`, Firefox `136`, and Safari/iOS Safari `17.4` were not executed.
Current Playwright WebKit provides engine evidence, not a shipping Safari run.
Safari 17.4 lacks `@starting-style`; display/overlay transition support also
varies at the supported minimums. These existing animation enhancements remain
progressive; this change adds no replacement animation. Custom JSX values that
serialize style attributes, including custom `round` values, remain a separate
CSP constraint.

### Input verification

October 15 follow-up: action spacing is now a component default in `a-input.css`.
Clear and trailing icon buttons measure 20/24/28px in 24/28/32px fields. Clear
slots have 2px padding, and trailing button groups have 2px end padding. The preview has no spacing classes
or CSS overrides. New CSP checks cover all sizes, direct and wrapped clear
controls, multiline alignment, RTL, static adornments, and empty slots.
All 121 source and 121 installed-package checks pass in the three current
engines, along with the existing 44 Input regressions. Both new inset checks
also pass in Chrome for Testing `135.0.7049.114`. The trailing-icon sizing
follow-up reran all 17 fast source and 17 fast installed-package checks, six
action-layout checks across current engines, and both Chrome 135 checks. The
layout cases also verify that labeled buttons keep their authored size.

Verified October 14, 2026 on `codex/input-external-css`:

- All 115 source checks and 115 installed-package checks passed in Chrome
  `155.0.8059.40`, Firefox `155.0`, and Playwright WebKit `26.6`. Both full and
  granular imports, React/Preact SSR and node-preserving hydration, forms,
  pointer/keyboard/touch, autogrow, ownership, reconnection, adoption, labels,
  hints, popup references, and both independent build orders are covered.
- CSP is supplied through HTTP response headers with same-origin scripts and
  styles, `style-src-attr 'none'`, and data images for masks. Input-only cases
  have no violations. Runtime textarea height and field measurement are checked
  through computed sizes under that policy, including a forced fallback path.
- Compared 16 registered variants against `56eafcdd` in all three engines and
  both import modes. All 96 geometry, typography, and appearance comparisons
  matched. The slow matrix saves screenshots and metrics in
  `tests/.test-output/input`. WebKit uses a separate permissive capture context;
  behavioral and computed-style checks retain CSP.
- The existing 44 Input accessibility, priority, and autosizing regressions pass.
  All 321 selected root regressions passed with CI's existing debounce exclusion,
  and all 100 shared fast component checks passed. Anta lint/type checking,
  sticker and Plot type checks, site CSS lint, workflow parsing, documentation
  review-marker checks, the Node `24.15.0` production build, and all 10 production
  checks passed. Production password, validation, and clear-cancellation demos
  passed in Chrome and WebKit.
- Chrome for Testing `135.0.7049.114` passed the initial 39 installed-package
  checks. An added native-spinner interaction probe then exposed a regression:
  the original shadow reset hides its number spinner, while the external part
  rule does not. `appearance: none`, `appearance: textfield`, and separate part
  rules for display, visibility, opacity, pointer events, and width did not
  suppress its native spinner. On October 15, the user accepted that older-engine
  difference to keep all defaults external. The regression check explicitly
  expects native number buttons in Chrome 135 and still checks keyboard stepping,
  value handling, and the remaining native control behavior. No shadow fallback
  is included, and this decision does not change the package's browser baseline.
  All 39 installed-package checks pass with that explicit expectation, and both
  original/current native-control comparisons pass in Chrome 135.
- Native-decoration comparisons confirm Firefox's number spinner was present in
  the original and remains present. Current Chrome and WebKit suppress it.
  Keyboard incrementing, raw search decoration suppression, password type
  changes, and native-dialog autofocus pass in current engines. Composition
  events are covered; operating-system IME, autofill, and password-manager flows
  were not manually exercised.
- Menu-dependent compositions retain Menu's existing blocked shadow stylesheet.
  Input introduces no shadow sheet, and its native field styling and popup
  references are checked independently. InputTime remains a separate refactor.
  Browser Input hydration uses a state-only commit through configured hooks;
  server and worker projections stay pure, and callback changes retain the
  native control and uncontrolled value.

Exact Edge `135`, Firefox `136`, and Safari/iOS Safari `17.4` were not executed.
Playwright WebKit is engine evidence, not a shipping Safari run. Existing
pre-upgrade skeleton behavior and motion are retained. Custom tone, radius, and
application style props can still serialize CSP-blocked style attributes.

### InputTime verification

Verified October 15, 2026 on `codex/input-time-external-css`, based on merged
Input PR #236 at `2d2ba6e6`:

- `pnpm test:input-time` passed 102 source checks in Chrome `155.0.8059.84`,
  Firefox `155.0`, and Playwright WebKit `26.6`. The final source matrix also
  passes with Playwright Chromium `153.0.8010.12`. The separate
  `pnpm test:input-time:package` matrix passed all 102 checks against an npm
  tarball installed in an isolated consumer, using Chromium `153.0.8010.12`,
  Firefox `155.0`, and WebKit `26.6`. Public full/granular exports resolve without
  Anta source aliases or workspace links. React/React DOM `19.3.0`, Preact
  `10.29.8`, and `preact-render-to-string` `6.7.0` generate their own SSR output;
  hydration retains authored nodes without recovery errors. Callback removal and
  reattachment retain uncontrolled values and the owned native inputs.
- HTTP responses supply `default-src 'self'; script-src 'self'; style-src 'self';
  style-src-attr 'none'; img-src 'self' data:; object-src 'none'`. Strict standalone
  cases have no CSP violations or injected shadow sheets. Coverage checks computed
  defaults, external part precedence, native segment sizes, and state changes.
  Consumer field/segment overrides remain effective through focus, status, size,
  and clock-mode changes. Dynamic application styles, custom tone, and numeric
  round props can still serialize CSP-blocked inline styles.
- The same source and installed-package suites each passed all 34 checks in
  Chrome for Testing `135.0.7049.114`. Select an exact executable with
  `ANTA_INPUT_TIME_CHROMIUM_EXECUTABLE` and set `ANTA_TEST_WEBKIT=0` for Chromium
  only. No browser baseline change or shadow styling fallback is introduced.
- Editing checks cover digit entry/auto-advance, 24-hour input in 12-hour mode,
  AM/PM editing, increment/wrap, page increments, incomplete values, selection,
  caret boundaries, modified shortcuts, canonical-time paste, and native touch
  focus. Locale checks cover `en-US`, `en-GB`, `fi-FI`, `ja-JP`, `zh-CN`, `ko-KR`,
  `ar-EG`, and `es-MX` in both clock modes, including period order, separators,
  label width, and stable AM/PM sizing. Form checks cover submission, required and
  range validity, critical status changes, reset, restoration callbacks,
  fieldset disablement, readonly, clear cancellation, and nested clear ownership.
- Labels and hints use live element references on the group. Explicit names,
  descriptions, invalid state, and error references retain their delegation.
  Chromium's accessibility tree confirms the named/described group and native
  segment textboxes. Reconnection preserves incomplete text and native nodes;
  adoption keeps editing in the new document, and document listeners and pending
  focus work are released after the last field disconnects. Reduced-motion checks
  include field and dim-action transitions. Input shares its existing focus
  coordinator through `input-focus-modality.ts`; editable typing does not request
  focus refreshes.
- Compared 11 registered variants against `2d2ba6e6` in three engines and both
  import modes. All 66 geometry, typography, and appearance comparisons matched;
  both Chrome 135 import modes also matched all 11 variants. Set
  `ANTA_INPUT_TIME_COMPARE_ORIGINAL=1` to repeat the comparison. Screenshots are
  saved in `tests/.test-output/input-time`. WebKit captures use a separate
  permissive capture page; behavior and computed-style pages retain strict CSP.
- Time-enabled InputDate commits edited time on blur under both import modes in
  every engine. Its Menu retains the existing blocked shadow stylesheet; those
  violations are checked separately from InputTime. This does not complete the
  remaining Menu or composed-component checklist items.
- All 142 shared fast component checks and all 336 selected root regressions
  passed, using CI's existing debounce exclusion. Anta lint/type checks, sticker
  and Plot type checks, site CSS lint, workflow parsing, and documentation author
  checks pass. The Node `24.15.0` production site build and 12 production checks
  passed. Two additional production checks confirm the InputTime controlled-value
  and clear-cancellation preview in Chromium and WebKit. Dedicated InputTime
  tests are registered with shared tiers and dependency-sensitive PR gates;
  expanded source/installed matrices and visual artifacts stay in slow coverage.

Review follow-up for PR #238:

- Padding focus uses compatibility `mousedown`, so a touch contact or scroll does
  not focus the editor. Pointer-origin markers are cleared on release,
  cancellation, focus departure, and keyboard navigation. Regressions cover
  completed taps, canceled touch contacts, Chromium trusted touch scrolling,
  refocus after clicking an already-focused segment, and cross-segment native
  caret placement. The stale refocus case fails against `c40420d3` and passes
  after the fix.
- Neutral status retains custom tone. Default group label/hint references are
  assigned once during the initial build and refreshed on reconnection. Both
  fields share the action classifier in `input-trailing-actions.ts`, observing
  only grouping child lists and their direct text nodes. Button label changes do
  not trigger classification. Clear names and nearest-field ownership are shared
  in the side-effect-free `input-events.ts`, also used by the JSX clear triggers.
- The suggested readonly normalization was not applied: incomplete edits retain
  their text and report an empty canonical value before and after readonly is
  enabled. This behavior predates the readonly guard. A regression verifies
  blur's empty `change` value and completing the time after unlocking, without
  erasing the partial input or inventing a complete time.
- The expanded source and installed-package suites each pass 140 checks in
  Chromium `153.0.8010.12`, Firefox `155.0`, and Playwright WebKit `26.6`.
  The touch-scroll protocol checks run only in Chromium; other engines retain
  synthetic contact/cancellation and completed-tap coverage. The installed suite
  also passes all 48 checks in Chrome for Testing `135.0.7049.114`. All 193 Input
  source checks and 336 selected root regressions pass after the shared-helper
  extraction. The Node `24.15.0` production build and all 14 production checks
  pass, along with lint, types, stylesheet lint, workflow parsing, and the
  documentation author check. Only the affected changelog package docs were
  regenerated for this follow-up.

Exact Edge `135`, Firefox `136`, Safari/iOS Safari `17.4`, and React `18` were not
executed. Playwright WebKit is engine evidence, not a shipping Safari/iOS run.
Touch gestures use browser automation; physical mobile keyboards were not
exercised. Paste checks supply clipboard payloads through synthetic paste events;
OS clipboard, IME, autofill, assistive-technology interaction, and real browser
history restoration were not manually exercised. Restoration checks invoke the
form-associated callback. The pre-upgrade neutral time skeleton and upgrade fade
retain their existing behavior.

## Scope and conclusion

Most Anta components can retain their shadow DOM while moving all their
stylesheet rules into external component CSS. Several need additional part
names or state exposure. Under the current architecture, Expander's measured
host corner radius needs a small dynamic stylesheet or a design change.

The audit covers the root `@antadesign/anta` package, its JSX wrappers, and
internal elements. It excludes the separate Stickers, Plot, and TypeDoc theme
packages. Avatar already has external part styling on the audited branch;
that statement does not describe the published `0.3.33` package.

"External" means rules in a component's `.css` file, applied from the document
through host selectors, light-DOM selectors, and `::part()`. Moving CSS text to
a separate file and adopting it into a shadow root still applies a stylesheet
inside that shadow root.

## Reported failure and current architecture

A consumer using Preact and Anta `0.3.33` reported an unstyled Menu dropdown and
Input filter under `style-src 'self'`, despite loading both bundle entries.
Their shadow `<style>` elements had `style.sheet === null`. Allowing
`'unsafe-inline'` restored styling.

The current source has two sources of styling:

| Source | Provides |
| --- | --- |
| External component CSS, included by granular imports or `bundle.css` | Tokens, reset, host rules, light-DOM rules, and existing part rules. |
| CSS strings inside element JS | Internal shadow layout, interaction rules, and some animations. |

The audit found `<style>` creation in 15 element modules. Expander creates both
a static sheet and a dynamic measured-radius sheet. Copy and InputTime clone
templates containing styles; Copy creates its shadow root lazily.

An isolated Preact experiment reproduced blocked Menu and Input shadow sheets
using current source. Intercepting their shadow style insertion and adopting
equivalent constructed stylesheets restored their layout with no CSP violations
in Chrome and WebKit. That experiment established a possible CSP fix; it did
not minimize shadow stylesheet rules or implement a package change.

## Components with shadow styles

The feasibility judgments below come from source inspection and platform probes.
They preserve existing behavior but are not completed component migrations.
Source links refer to the audited files; line numbers may change.

| Component or internal element | Can remove all shadow stylesheet rules? | Required changes or constraint |
| --- | --- | --- |
| [Avatar](src/elements/a-avatar.ts) | Already done on this branch. | Frame, image, and badge use external part rules in `a-avatar.css`. |
| [Card](src/elements/a-card.ts) | Yes; straightforward. | Every styled region already has a part. Move layout, focus, selection, and loading animation rules outside. |
| [Progress](src/elements/a-progress.ts) | Yes. | Indicator already has a part. Add one to the content slot. Move positioning, the indicator pseudo-element, and loading keyframes outside. Internal progress-value updates can remain in JS. |
| [Tooltip](src/elements/a-tooltip.ts) | Yes. | Bubble already has a part. Add one to the popover container. JS positioning and proximity opacity updates can remain. |
| [Menu](src/elements/a-menu.ts) | Yes. | Surface and scroll region already have parts. Add parts to header/footer slots and style their light-DOM content externally. Popover transitions and scroll fades can move too. |
| [Input](src/elements/a-input.ts) | Yes, with focus and mode adjustments. | Named slots, field, and native control already have parts. Expose equivalent state for the internal focus relationship and button-placeholder class. Distinguish input, textarea, and button modes where their rules differ. Placeholder and native decoration rules can move outside. |
| [InputTime](src/elements/a-input-time.ts) | Yes. | Fields, segments, separators, and named slots already have parts. Replace internal relationships controlling adornment opacity with inherited variables or exposed state. Placeholder styling can move outside. |
| [Banner](src/elements/a-banner.ts) | Yes, with a visibility adjustment. | Parts already exist. Expose equivalent state for the internal actions-slot `[hidden]` flag, preserving empty-wrapper and whitespace handling. |
| [Dialog](src/elements/a-dialog.ts) | Yes, with state adjustments. | Parts cover all regions. Replace internal slot-content classes and sibling selectors with exposed states or suitable host selectors. Modal state and backdrop styling can be targeted externally. |
| [Panel](src/elements/a-panel.ts) | Yes. | Content already has a part. Add one to the placeholder. The existing `maximized` custom state can control its visibility. Backdrop styling can move outside. |
| [Text](src/elements/a-text.ts) | Yes, with additional parts and state. | Add parts for the content slot and expand button. Expose overflowing/expanded state instead of private classes and sibling selectors. Clamping, masks, and the chevron pseudo-element can move outside. |
| [Slider](src/elements/a-slider.ts) | Yes, with extensive selector work. | Add parts for the rail container, value separator, and value affixes. Distinguish inline/end values and expose hidden, dragging, pointer-focus, and active-thumb states. Current parts alone cannot express every rule. |
| [Toaster](src/elements/a-toaster.ts) | Yes. | Region already has a part. Give each placement slot a distinct part. Move toast-child pointer handling into external light-DOM selectors. |
| [Toast](src/elements/a-toast.ts), internal element | Yes, with a countdown adjustment. | Add a part to its content slot. Move entry/exit rules and countdown keyframes outside. Change how JS starts the countdown so its animation name resolves in the external stylesheet's scope. Preserve pause, restart, and remaining-time behavior. |
| [Copy feedback](src/elements/a-copy.ts), `a-copy` | Yes, with state adjustments. | Feedback already has a part. Expose its below-anchor, measuring, and showing states instead of selecting internal `data-*` attributes. Move feedback keyframes outside. |
| [Expander](src/elements/a-expander.ts) | Almost; a small dynamic rule remains under current conventions. | Static layout, collapse animation, indicators, and interaction rules can move after adding parts/state. The measured host radius needs special treatment. |

## Expander's measured radius

Boolean `round` uses half the folded header height as the host radius, including
while expanded. A ResizeObserver measures the header, and a shadow `:host` rule
publishes `--_expander-round-radius`. External `a-expander.css` reads that value.
See `measureRoundRadius()` in the [element](src/elements/a-expander.ts) and the
rounded-host rule in its [stylesheet](src/elements/a-expander.css).

External CSS cannot receive that arbitrary measured value without a runtime
channel. A custom property set on the internal header does not inherit upward
onto the host. Anta currently prohibits element-owned runtime changes to host
inline styles and attributes.

| Choice | Consequence |
| --- | --- |
| Keep a small per-instance constructed stylesheet. | Preserves the current shape and architecture. All static shadow rules can move outside. The dynamic sheet must not be shared across instances. |
| Permit JS to update a host custom property through CSSOM. | Removes the remaining shadow rule but changes Anta's host-mutation convention. |
| Redesign where the rounded surface is drawn. | Could remove the remaining rule, but requires a larger layout change and visual verification. |

This is a constraint of the current geometry and architecture, not a universal
web-platform requirement that Expander must contain shadow styles.

## Components already using external styling

These components have no shadow stylesheet to migrate. This does not establish
complete CSP compatibility for every JSX prop or server-rendered output.

| Components | Current situation |
| --- | --- |
| Button, Checkbox, Switch, RadioGroup | External styles and light-DOM behavior. |
| Title, Tag, Icon, Loader | External styles without a shadow stylesheet. |
| Box, Capture | Light-DOM containers and behavior. |
| Calendar | Light-DOM rendering and external styles. |
| MenuItem, MenuGroup, MenuSeparator | External styles. A containing Menu has the shadow styling described in the audit. |
| Tabs, TabPanel | External styles. Internal Radio and Tab elements also have no shadow stylesheet. |

The exported component inventory is in [src/index.ts](src/index.ts), and browser
element registration is in [src/elements/index.ts](src/elements/index.ts).

## Composed components

These wrappers introduce no independent shadow stylesheet. Their nested elements
determine whether a particular configuration depends on shadow styles.

| Component | Shadow styles it can depend on |
| --- | --- |
| ButtonCopy | Copy feedback when floating confirmation is used. |
| MenuItemCopy | Copy feedback; its containing Menu also needs migration. |
| Breadcrumbs | Menu for collapsed items, and copy feedback for applicable copy actions. |
| InputDate | Input and Menu. Calendar already uses external styling. |
| InputAutocomplete | Input and Menu. |
| Select | Input, Menu, and optional Tooltip. |
| SelectFaceted | Input, Menu, and optional Tooltip. |
| Steps | Tooltip for applicable step hints. Tabs already use external styling. |

## Browser evidence

Platform probes ran on October 5, 2026 in Chrome `154.0.8037.98`, Playwright
Firefox `151.0`, and Playwright WebKit `26.6`. WebKit testing is engine evidence,
not verification on every shipping Safari version.

The selector probe served external JS and CSS over local HTTP with this response
header:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'
```

| Capability | Observed result |
| --- | --- |
| External `::part(...)::placeholder` styling | Worked in Chrome, Firefox, and WebKit. |
| External `::part(...)::before` styling | Worked in all three. |
| Dialog and popover `::part(...)::backdrop` styling | Worked in all three. |
| External `::part(...):focus-within` | Worked in all three. |
| External `::part(...):has(input:focus)` | Chrome and Firefox rejected the selector. WebKit accepted and applied it. It is not a portable replacement for Input's internal focus selector. |
| Attribute selectors after `::part(...)`, or descendant selectors continuing into its internal children | Rejected in all three. Expose the needed state or target as a part instead. |
| External keyframes applied by an external part rule | Worked in all three. |
| JS assigning an animation on a shadow node, with the keyframes defined only in the document | No animation in Chrome; an animation was created in Firefox and WebKit. Toast needs an assignment adjustment for portable external keyframes. |
| CSP violations in the selector probe | None. |

A separate interaction probe checked native number spinners and search-clear
buttons in Chrome and WebKit. It compared native controls, controls styled through
external part rules, and controls styled inside their shadow root. Clicking the
native decorations changed or cleared the baseline values. Both styled variants
prevented those decoration actions. The external selectors used were
`::part(control)::-webkit-inner-spin-button`,
`::part(control)::-webkit-outer-spin-button`, and
`::part(control)::-webkit-search-cancel-button`.

The initial `getComputedStyle()` checks for native decorations did not reliably
show the styling effect. The interaction probe provided the behavioral evidence.
Selector parsing alone is insufficient evidence that a rule changes rendering.

The probes were ephemeral and did not change repository source. Their scripts,
screenshots, and raw output were not saved as a reusable test suite. Minimum
supported browser versions and complete component behavior remain unverified
for the proposed migration.

## Migration proposal

Move static shadow rules into external component CSS. Use stable part names for
visual regions and explicit state for conditions external selectors cannot read.
Keep Expander's measured-radius rule in a per-instance constructed stylesheet
initially. Do not replace that rule with a CSP-blocked `<style>` fallback.

Consumer imports can stay the same. Full bundle usage still pairs JS and CSS.
Granular usage still loads tokens, optional reset, and UI element entries. JSX
wrappers remain independent of UI-side CSS and registration. `bundle.css` would
gain rules currently carried as CSS strings in element JS.

Additional parts become consumer styling surfaces. Choose their names
deliberately, and preserve current part names and customization behavior.
Moving defaults into the document also changes their cascade context. Keep Anta
defaults layered and verify that consumer overrides still behave as documented.

## Remaining CSP work and future validation

Shadow stylesheet migration does not address HTML `style` attributes produced
by server-rendered JSX. Fixed wrapper styles, including Input's
`display: contents` spans, should move into external CSS. Numeric sizing,
custom tones, and other style-generating props need a separate SSR audit.
Direct CSSOM property assignments and parsed HTML style attributes have
different CSP behavior.

Before claiming library-wide support, validate the following:

- Use actual CSP response headers, including `style-src-attr 'none'`, and collect
  `securitypolicyviolation` events.
- Test full bundle and granular imports from a packed package.
- Cover Menu with Input, nested menus, Input button/textarea modes, InputTime
  segments, and pointer versus keyboard focus behavior.
- Cover Dialog and Panel backdrops, top-layer positioning, transitions, and
  close/restore behavior.
- Cover Text truncation/expansion, Slider scalar/range modes and markers, and
  empty slots in Banner and Card.
- Cover Progress loading, copy feedback placement, and Toast countdown pause,
  restart, and dismissal.
- Cover Expander custom header heights, boolean and fixed `round`, indicator
  variants, actions, reduced motion, and multiple independent instances.
- Verify pre-upgrade skeletons, layout stability, forced colors, nested
  composition, and documented consumer overrides.
- Test iframe/document ownership for any remaining constructed sheets.
- Run checks in minimum supported browser versions and verify SSR/hydration
  separately from client rendering.

Use the existing [consumer fixtures](tests/consumers/README.md) and
[Avatar CSP regression](tests/avatar-csp.test.mjs) as starting points when this
work is authorized.

## References

- [Shadow part selector capabilities and limitations](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::part).
- [CSS Shadow Module Level 1 editor's draft](https://drafts.csswg.org/css-shadow-1/), covering parts, inheritance, and scope.
- [CSS names across shadow boundaries](https://developer.chrome.com/docs/css-ui/css-names). The article is dated August 2024; current browser probes are recorded separately in this audit.
- [Constructed shadow stylesheets and document ownership](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets).
- [CSP style sources and direct JavaScript style assignments](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src).
- [Anta component architecture](src/AGENTS.md), including declarative host ownership, shadow parts, and the Avatar CSP convention.

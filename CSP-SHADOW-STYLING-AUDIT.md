# CSP and shadow styling audit

Recorded October 5, 2026 against commit `f4255b8` on
`fix/granular-element-css`, with the package version set to `0.3.34`.
This is a research snapshot and migration proposal. The proposed migration has
not been implemented.

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

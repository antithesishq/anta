# CSP and shadow styling audit

Recorded October 5, 2026 against commit `f4255b8` on
`fix/granular-element-css`, with the package version set to `0.3.34`.
This is a research snapshot and migration proposal. The proposed migration has
not been implemented.

The [Card research and implementation plan](#card-research-and-implementation-plan)
below records the first component review on October 13, 2026.

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

## Card research and implementation plan

Recorded October 13, 2026 against `dade41d`, on the dedicated
`codex/csp-shadow-styling` branch. This section is a plan. Card implementation,
public APIs, and shipped CSS have not changed.

### Goals and architecture decision

Card should render under strict CSP, avoid an invisible first paint, and preserve
application ownership of the host and its light-DOM children.

The selected approach is to retain Card's shadow structure, move every static
style into `a-card.css`, and validate a visible pre-upgrade layout. The user
confirmed this scope on October 13, 2026. Full light-DOM restructuring is outside
this first refactor. All eight visual regions already have parts:
`container`, `media`, `content`, `header`, `icon`, `title`, `body`, and `footer`.
No additional parts or runtime styling state are needed for that migration.

External CSS alone does not solve the initial-render problem. `::part()` can style
the structure after it exists, but Card creates that structure in its constructor.
A visible pre-upgrade layout therefore needs its own validation before removing
the current hiding rule. The [shadow parts specification](https://www.w3.org/TR/css-shadow-parts-1/)
defines the external styling mechanism.

| Approach | Initial render | Compatibility and ownership |
| --- | --- | --- |
| External CSS, existing shadow structure, visible CSS fallback | Can paint content before registration. Matching complex slot composition still needs proof. The native link exists only after upgrade. | Preserves slots, parts, and raw HTML. The element continues to mutate only its owned shadow nodes. Selected approach. |
| Declarative light-DOM structure emitted by the wrapper or raw author | Layout and a native link can exist in the initial HTML. | Requires explicit section and anchor markup. Existing raw slot composition and part overrides need a migration design. The element must never insert, move, or rewrite renderer-owned nodes. |
| Declarative shadow DOM | Parsed HTML can contain the final shadow structure before element registration. | Requires an SSR and hydration design, plus constructor changes to reuse the parsed structure. Client rendering needs a separate path. Broader than Card's stylesheet migration. |

The [HTML template specification](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element)
defines declarative shadow roots. Renderer compatibility for Anta has not been
tested. This option is not part of the initial implementation recommendation.

If identical first-render layout and a working link without element JavaScript
are requirements, choose declarative light DOM as a separate API change. A CSS
fallback cannot provide the missing shadow anchor. Radix Themes provides an
established [Card composition example](https://www.radix-ui.com/themes/docs/components/card#as-another-element)
where the author supplies the native anchor.

### Current findings

- `a-card.css` owns the host surface, tokens, variants, empty-region selectors,
  heading margins, and icon-chip styling. Its `a-card:not(:defined)` rule sets
  `opacity: 0` and adds padding. Registration removes that padding and exposes
  the shadow layout. The host transition then fades in under normal motion.
- `a-card.ts` injects one shadow `<style>` per instance. It provides layout,
  anchor reset, focus and selected rings, pointer blocking, and loading keyframes.
  Every selector has an existing host/part equivalent.
- The element only observes `href`, `target`, `rel`, `ping`, `loading`, and
  `aria-label`. It writes navigation attributes, `aria-busy`, and the derived
  accessible name onto its shadow anchor. It does not rewrite host attributes or
  light-DOM children.
- Link naming reads text on connection, observed-attribute changes, and
  `slotchange`. Editing text inside an already assigned header does not trigger
  a naming update. Host `aria-labelledby` is not delegated to the shadow link.
- Body presence uses `:has(> :not([slot]))`, which requires an element. A raw
  text-only body is hidden. Whitespace-only element wrappers still count as
  present. These behaviors need an explicit compatibility decision rather than
  an incidental change during selector migration.
- The JSX wrapper emits a footer span with inline `display: contents`. Move this
  fixed layout declaration into external CSS using a wrapper-owned structural
  tag. Preserve the existing footer slot and direct raw-HTML footer behavior.
  Custom tones and numeric/string radius props also produce inline custom
  properties; their SSR CSP compatibility remains separate work.
- Some heading selectors reach every descendant of a Card, including nested
  components. Record nested-Card behavior before changing their scope.

### Baseline browser evidence

A local HTTP fixture bundled the unchanged Card element from source with
esbuild. It loaded same-origin external JS and CSS, delayed registration until
after measuring the initial layout, and collected CSP violation events,
host/light-DOM mutations, and browser accessibility snapshots. Motion was reduced
to make the before/after measurements stable. No Anta reset or theme was loaded;
the fixture used a 320px card and system sans-serif text.

The strict response header was:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'
```

Chrome `155.0.8059.40`, Playwright Firefox `155.0`, and Playwright WebKit `26.6`
all produced these results:

| Probe | Result |
| --- | --- |
| Five Card instances under strict CSP | Five `style-src-elem` violations for inline sheets. Every shadow style had `sheet === null`; the anchor computed to `display: inline`. |
| Same fixture without CSP | No violations; the anchor computed to `display: flex`. |
| Header/body/footer Card before registration | Host opacity was `0`; height was 128px. |
| Same Card after registration without CSP | Host opacity was `1`; height was 130px. Under strict CSP, the broken layout was 104px high. These are fixture measurements, not general size guarantees. |
| Registration mutation observer | No host or light-DOM mutations. Shadow-internal writes were outside the observer's tree. |
| In-place header text edit | Visible heading changed; link name remained `Initial heading`. |
| Host `aria-labelledby` pointing to external text | Shadow link kept its header-derived name, `Header fallback`. |
| Host `role="article"` plus `aria-label` | Accessibility tree contained a named article with a separately named native link inside it. Host semantics and link semantics are distinct. |
| Loading link | Shadow anchor had no `href` and had `aria-busy="true"`. |
| Raw text-only body | Body slot computed to `display: none`; host height was zero after upgrade. |

Local probe files are `/tmp/anta-card-research.cjs` and
`/tmp/anta-card-research-results.json`. They are temporary research artifacts,
not a saved regression suite. The implementation must add durable coverage.
These probes do not verify React/Preact rendering, minimum browser versions,
SSR/hydration, or a proposed CSS migration.

### Ownership contract

| Surface | Owner and permitted behavior |
| --- | --- |
| Host attributes, classes, styles, IDs, role, and ARIA | JSX wrapper or raw-element author. Card reads them. It must not remove, normalize, or reflect them back. |
| Light-DOM nodes and their attributes | Renderer or raw author. Card may read assigned content and observe narrowly when needed. It must not move nodes or write ARIA onto a slotted node. |
| Shadow anchor and slots | Card element. It may update its own anchor's navigation attributes and supported semantic inputs. It may not create a second host tab stop or synthetic host link role. |
| Visual appearance and loading animation | External layered CSS. Host attributes select variants; parts select internal regions. No injected stylesheet or runtime host styling is needed for Card. |
| Wrapper-generated layout nodes | Stateless wrapper projection, with external CSS. Their structure and attributes are authored by the wrapper, never patched by the element. |
| Selected state | Application-authored attribute used for the visual ring. Do not infer checkbox, radio, button, or `aria-selected` semantics from it. |

Keep the documented `aria-label` bridge to the owned anchor for the first CSS
migration. Do not copy every host `role` or `aria-*` declaration onto that anchor.
The current form-control exception permitting host ARIA consumption in
`src/AGENTS.md` does not authorize Card to strip host attributes.

Before a semantic follow-up, define whether each ARIA input describes the Card
container or its link. In particular, establish the contract for
`aria-labelledby`, `aria-describedby`, `aria-current`, host `role`, and explicit
`aria-busy` before adding delegation. Cross-root references on an owned shadow
anchor should use element-reference APIs through `shadow-aria.ts`, once routing
is defined. Header/body references could also keep names current without copying
text; validate their naming behavior and fallback order first. Preserve explicit
consumer input and avoid whole-host mutation observers as a default.

The [ARIA in HTML specification](https://www.w3.org/TR/html-aria/#docconformance)
distinguishes the semantics of custom elements and native controls. It does not
define Anta's routing contract.

### Implementation sequence

1. **Record compatibility and ownership.** Add durable Card fixtures covering
   raw slot markup and JSX output. Freeze current visual and navigation behavior
   and record the known naming/text-body gaps separately. Observe the host and
   light DOM across connection and application-driven updates.
2. **Externalize the stylesheet.** Move the shadow rules into
   `@layer anta.components` in `a-card.css`, using existing parts and host
   attributes. Place base part rules before empty-region overrides so hidden
   slots stay hidden. Keep keyframes and animation assignment in the same
   external stylesheet scope. Remove `SHADOW_STYLE` and style insertion, and
   update comments that describe the old styling ownership. Preserve DOM shape,
   focus behavior, slots, parts, and supported ARIA behavior.
3. **Remove the fixed footer inline style.** Emit an explicit wrapper-owned
   structural tag, declare its intrinsic type, and style it externally. Update
   wrapper documentation and generated package docs only where required. Test
   multiple footer actions and raw footer content under `style-src-attr 'none'`.
4. **Prove a visible pre-upgrade layout.** Investigate external grid/flex rules
   for the current flat slot markup. Compare header/subtitle/icon grouping,
   multiple body children, and all media positions against the final layout.
   Measure child rectangles and the following sibling before/after registration,
   including delayed and failed JS. Remove full-host hiding and its entrance
   fade only once the supported composition matches. If the flat markup cannot
   express the grouping, document the failing case and revisit scope with the
   user before implementing a larger structural change.
5. **Resolve semantics separately.** Review the stale-name and ID-reference
   findings with the ownership contract. Make any naming/routing change a
   separate reviewable commit with browser accessibility and renderer-update
   coverage. Keep nested interactive controls in linked cards outside this
   migration; they need a separate interaction design.
6. **Verify the package and document the result.** Run the relevant browser
   suite, build, lint, typecheck, and root regression tests. Verify full-bundle
   and granular assets from a freshly packed package. Update the Card docs and
   consumer-facing changelog for the shipped behavior, then record Card's
   migration status in this audit. Consumer app fixtures run only when requested.

### Acceptance checks

- Real CSP response headers, including `style-src-attr 'none'`, produce no Card
  styling violations for the covered markup. No shadow stylesheet remains.
- All existing parts remain usable. Unlayered consumer part overrides, including
  a scrollable body and header divider, work in rest, focus, selected, and loading
  states. Verify inheritance and cascade after moving defaults into the document.
- Cover every media position, sizes, priorities, light/dark modes, empty regions,
  subtitle-only and icon-only headers, nested Cards, and constrained heights.
- Pointer and Enter navigation, target/rel/ping updates, `href` removal, and
  loading toggles preserve native behavior. The focus ring uses `:focus-visible`;
  loading removes navigation; selected state remains visual.
- Loading animation runs through the external part rule, pauses its visual effect
  under reduced motion as currently intended, and does not hide content when
  created inside a collapsed subtree. Check forced-color focus and selected
  affordances rather than relying on box shadows alone.
- Initial content is visible once external CSS loads. Delayed registration does
  not introduce a visible layout jump for the supported composition. Verify
  actual geometry and screenshots, not only selector parsing or `:defined`.
- Card makes no host or light-DOM mutations during upgrade or subsequent updates.
  Check accessible semantics in the browser tree. A semantic follow-up must cover
  in-place text edits and standard ARIA property updates/removal in React 19.
- SSR footer markup contains no fixed inline layout style. Custom tone and radius
  style output stays explicitly outside any broad SSR CSP compatibility claim.

Add a dedicated `test:card` browser command for the new matrix and gate its CI
step on Card, shared runtime, dependencies, tests, and workflow changes. Manual
CI runs should include it, following the repository's component-matrix convention.

## References

- [Shadow part selector capabilities and limitations](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::part).
- [CSS Shadow Module Level 1 editor's draft](https://drafts.csswg.org/css-shadow-1/), covering parts, inheritance, and scope.
- [CSS names across shadow boundaries](https://developer.chrome.com/docs/css-ui/css-names). The article is dated August 2024; current browser probes are recorded separately in this audit.
- [Constructed shadow stylesheets and document ownership](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets).
- [CSP style sources and direct JavaScript style assignments](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src).
- [Anta component architecture](src/AGENTS.md), including declarative host ownership, shadow parts, and the Avatar CSP convention.

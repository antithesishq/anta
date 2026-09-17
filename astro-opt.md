# Astro build optimization findings

Recorded September 16, 2026, while updating PR #169 on branch `plot`.
The baseline is commit `a69849e`, with Astro pinned to `7.3.3`.

The original investigation was recorded on `plot` without implementing the
proposals. Follow-up implementation began September 17 on `perf/astro-build`,
based on `db48d4c`. PR #169 was still open when the new branch was created.

## Native Markdown migration results

Implemented September 17 on `perf/astro-build`, after the broader review below.
The site now uses `@astrojs/markdown-satteri@0.4.1` with Astro `7.3.3`.

### Implementation and control

- Replaced the explicit unified processor with Sätteri and enabled full MDX
  static optimization, including table cells.
- Consolidated the local transforms in `site/lib/satteri-plugins.mjs`: standalone
  image unwrapping, JSX paragraph unwrapping, heading links, and Markdown table
  wrappers. These remain ordinary JavaScript visitors with control over the
  generated Markdown/HTML trees.
- Generate Astro's heading IDs before creating heading links. Pass the factory
  so duplicate-heading state resets for each document.
- Removed nine direct unified dependencies and added one direct native
  dependency that was already installed transitively. The lockfile removes 37
  package records without unrelated version upgrades. Some unified packages
  remain transitive dependencies, including in the highlighting stack.
- Kept interactive examples in their existing imported JSX components and
  external Playground demo source. Preserved the generic JSX paragraph transform
  because 164 elements across 26 pages rely on it. No broad demo rewrite was
  necessary.
- Made nine live Table token labels explicit JSX strings so smart punctuation
  cannot change their `--` prefix. The Markdown exporter now handles plain
  quoted string expressions without evaluating JavaScript. Escaped/dynamic
  expressions are not interpreted; fenced and inline examples stay unchanged.

### Measured build improvement

Isolated Astro production builds, with one warmup per pipeline followed by
three measured runs per pipeline in alternating order:

| Pipeline | Runs | Median |
| --- | --- | --- |
| unified | 14.445 s, 14.528 s, 14.598 s | 14.528 s |
| Sätteri | 10.712 s, 11.016 s, 10.491 s | 10.712 s |

The Astro build stage is 26.3% faster, saving 3.816 seconds per build in this
local comparison. Both pipelines used the same source and installed dependencies;
the baseline configuration restored the processor and transforms from `c4ee8f1`. Browser
tests and dev servers were stopped for these runs. Measurements include the
Astro CLI process, compilation, rendering, and sitemap integration, but exclude
package preparation and the separate search-index/worker postprocessing.

Environment: Node `24.10.0`, pnpm `10.11.1`, local macOS. These are not Cloudflare
build measurements. Preliminary whole-site timings taken alongside browser
captures are excluded because competing work made them unsuitable for comparison.

### HTML, CSS, and visible differences

The output inventory covers all 52 HTML files, including 44 documentation pages
with a `main.content` region. Heading IDs/text, content-link targets/text, class counts,
authored inline style blocks, and table row counts remain unchanged.

- Markdown table alignment is still inline CSS. Serialization changes from
  `text-align:right` to `text-align: right`; computed styles and appearance match.
  Native output also contains different insignificant table whitespace.
- Authored JSX tables remain unwrapped. Markdown tables retain one `.table-wrap`.
  Heading anchors retain `header-anchor muted` and the existing URLs.
- Contrast ratios now render correctly in `/accessibility/`, `/input/`, and
  `/changelog/dev/`. The former directive plugin consumed nine `:1` fragments and
  inserted broken block structure. Removing that syntax restores the complete
  ratios and removes the unwanted wrappers/empty paragraphs. These are intentional
  visible corrections, not identical screenshots. Accessibility becomes 96 px
  shorter at the tested desktop width and 52 px shorter on mobile.
- The nine Table token labels now show literal `--` instead of the em dash
  produced by the old pipeline. Font styling is unchanged; the corrected glyph
  widths slightly change automatic table-column sizing.
- CSS rule contents are unchanged. The initial native build emitted an additional
  848-byte stylesheet on `/capture/`, identical to its existing
  `WheelCapturePreview` stylesheet. The Astro demo wrapper described below removes
  that duplicate through the normal component compiler.
- `/llms.txt`, `/llms-full.txt`, and generated `docs/packages/table.md` are
  byte-for-byte unchanged from the baseline. Search indexing reflects the
  repaired prose: 9,615 blocks become 9,612.

### Validation

The final visual pass compared Title, Table, Button, Expander, Accessibility,
Text, Avatar, Changelog, Input, and the development changelog at desktop/mobile
widths in light/dark modes. It also compared expanded Button reference/styling,
Expander styling, and Input styling sections.

Thirty of 43 full-page screenshot pairs were pixel-identical, including expanded
Button and Expander sections. The remaining 13 pairs show only the intentional
corrections above: Accessibility (four), Table (four), the development changelog
(four), and expanded Input styling (one). Table differences affect 0.09–0.35% of
pixels. No missing assets or browser errors were reported. Playground interaction
is covered separately by the production tests.

- Root regression suite: 190 tests passed, including eight native processor
  tests and three additional Markdown-export regressions.
- Four production browser tests passed. Coverage checks table layout, literal token labels, inline
  JSX children, contrast ratios, ClientRouter navigation, Playground editing and
  recompilation, search highlighting, folded content, and code copying.
- Root build, custom lint, site CSS lint, and frozen-lockfile installation passed.
- The root dev launcher served Title, Table, and Expander successfully with no
  browser errors. It was stopped after the check. The separate remote AI Worker
  still requires a Cloudflare API token; that existing integration was not
  changed or exercised against the live service.

Local comparison artifacts and timing logs are in
`/tmp/anta-markdown-validation/`. No deployment was performed.

### Follow-up: client-only demo boundary

`WheelCaptureDemo.astro` now owns the preview layout and `client:only="preact"`
directive. The MDX page imports that wrapper; `WheelCapturePreview.tsx` and its
CSS module remain unchanged. The native MDX processor no longer directly
references the browser-only component, so its stylesheet appears only once.
Capture links 14 distinct stylesheets instead of 15, removing the duplicate
848-byte asset and request without adding stylesheet-deduplication logic.

All four before/after Capture screenshots (desktop/mobile, light/dark) are
pixel-identical. Five production browser tests and five preview regression tests
pass, including wheel-demo mounting, keyboard scrolling, reset, and a check for
duplicate linked stylesheets. The production build and site CSS lint pass.
Both LLM endpoints and generated `docs/components/capture.md` are byte-identical
to their previous output. The local dev server remains available for inspection.

## Broader Astro and Cloudflare review

Historical September 17 review, recorded before the native Markdown migration
above. These recommendations broaden the initial performance-only decision table.
The remaining Content Layer, Cloudflare, and integration migrations are still
proposals; no deployment architecture changed in this work.

### Adopt Astro 7's native Markdown processor

Sätteri is a practical next migration. Inspection of our installed
`astro-expressive-code@0.44.2` found an existing Sätteri integration, including
insertion of its highlighting plugin into the processor. Expressive Code does
not require us to keep unified.

A read-only parser audit of 44 Markdown/MDX files under `site/src`, including
generated changelog Markdown, found 64 tables and 519 code blocks, but no math
or definition-list nodes. A separate syntax scan found no attribute-extension
usage. The nine directive nodes were all `:1` fragments in contrast ratios,
rather than authored directive components. Preserve complete contrast ratios
in a regression test when removing that parser extension.

Replace GFM and heading-ID plugins with native capabilities. Remove unused
syntax extensions after output checks. Port table wrapping, heading-link
wrapping, and the image/JSX paragraph transforms that remain necessary. Keep
heading IDs stable for incoming links, and preserve our code themes, folding,
copy controls, MDX styles, table alignment, and live previews. The separate
npm/LLM Markdown renderer remains necessary.

The native processor has built-in Markdown features and its own plugin API.
Its plugin guide even includes an image-unwrapping transform similar to ours.
See [Astro 7 Markdown](https://astro.build/blog/astro-7/) and
[Sätteri plugins](https://satteri.bruits.org/docs/plugins/).

### Consolidate the Cloudflare runtime

Current architecture:

```text
Pages static site
  /api/search-answer -> custom Pages Worker -> SEARCH_CHAT service binding
    -> separate chat Worker -> AI_SEARCH

Local development
  Astro -> Vite proxy on a second port -> wrangler dev chat Worker
```

Proposed architecture:

```text
Workers with Static Assets + Astro Cloudflare adapter
  documentation and assets -> prerendered files
  /api/search-answer -> Astro API route -> AI_SEARCH

Local development
  root package watcher + Astro's integrated Cloudflare runtime
```

The current Astro Cloudflare adapter targets Workers, not Pages. Its dev and
preview environments support `workerd` and direct Cloudflare bindings. This is
a Pages-to-Workers migration, not an adapter that can be added to the current
Pages deployment unchanged. See the
[adapter documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/).

Keep documentation prerendered and make only the API route dynamic. Astro can
combine static routes and request-time endpoints. See
[on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/).

The following code becomes removable after the new runtime is verified:

- `site/lib/search/worker.ts`, the Pages forwarding wrapper.
- `site/scripts/build-search-worker.mjs` and its preparation task.
- `site/public/_routes.json` and the `SEARCH_CHAT` service binding.
- `site/wrangler.chat.jsonc`, if chat no longer needs independent deployment.
- The Vite API proxy and its origin-rewriting workaround.
- The separate `dev:search` process, port plumbing, and second environment type.

Move the request handler out of the chat Worker's default `fetch` wrapper and
call it from an Astro API endpoint with the direct AI Search binding. Keep the
request limits, source verification, cancellation, timeout, sanitization, and
streaming protocol. Those are application behavior, not routing boilerplate.
The [AI Search binding](https://developers.cloudflare.com/ai-search/api/search/workers-binding/)
supports the existing chat call from a Worker.

Use an endpoint for the streamed response. Astro Actions' RPC results are
serialized values. The installed Astro 7 runtime explicitly rejects returning
a `Response` from an action and directs callers to server endpoints. Actions
would be useful for a future ordinary feedback form, but do not replace this
SSE stream. See [Actions](https://docs.astro.build/en/guides/actions/).

Migration acceptance checks must cover custom domains, prerendered/static
delivery, redirects, `_headers`, search postprocessing output paths, and preview
bindings. Pages' preview environment behavior does not transfer automatically
to Workers. Rework the Pages-specific deploy/cleanup workflows only after
replacement preview builds work. See
[Cloudflare's migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

The inspected adapter was `@astrojs/cloudflare@14.3.2`. It can add session KV and
Images bindings by default. Choose those settings explicitly: disable sessions
until needed, and select build-time image processing for the current static
image workload. Assess `prerenderEnvironment: 'node'` if build-only dependencies
need Node APIs. Retain a preview deployment until the production cutover is
ready. No infrastructure was changed during this review.

### Use the Content Layer to remove duplicated page metadata

Page metadata currently lives in the sidebar inside `DocsLayout.astro`,
`component-slugs.ts`, `componentGroups`, `documentationLinks`, `packageLinks`,
and path-specific glob handling in `llms-full.txt.ts`. The 46-line
`check-llms-index.mjs` catches some drift, but does not remove the duplication.

Introduce a schema-validated catalog containing title, canonical path, kind,
navigation group/order, and inclusion in exported documentation. Derive the
sidebar, breadcrumb classification, and LLM indexes from it. Start with a shared
data file consumed by an Astro `file()` collection and the standalone npm docs
generator. That avoids making package publishing depend on Astro virtual
modules. Then consider moving MDX bodies into a `glob()` collection with one
catch-all route, preserving all current URLs.

Astro's [Content Layer](https://docs.astro.build/en/guides/content-collections/)
provides loaders, schema validation, and collection queries. The primary benefit
here is one source of metadata. It does not replace our rendered-block search
index or custom MDX-to-Markdown conversion.

Keyed collection routes would also provide a natural place to evaluate Astro
7.2 incremental builds later. Include generated API/reference inputs in cache
invalidation, and preserve the cache across CI builds before expecting reuse.

### Make the remaining site tooling an Astro integration

The new Node coordinator improves the existing build. A local Astro integration
could own site preparation and postprocessing, so a direct `astro build` also
creates a complete site. Move reusable task functions behind lifecycle hooks,
use the configured output directory, and retain standalone entry points needed
by package publishing. Keep package compilation under the root watcher.

Search indexing depends on rendered HTML and belongs after rendering. Preserve
its block IDs, ignored UI content, folded-section anchors, and deterministic
ordering. Test hook ordering against the Cloudflare adapter's output packaging.
The [Integration API](https://docs.astro.build/en/reference/integrations-reference/)
provides the hooks. This API predates Astro 5, but is relevant to reducing our
custom orchestration.

### Adopt smaller framework features

| Change | Concrete opportunity |
| --- | --- |
| Astro 5 typed environment variables | Declare the optional public PostHog token with `astro:env`. Omit analytics when unset instead of shipping the browser-side missing-token diagnostic. Cloudflare service bindings stay in generated Worker types. |
| Astro 5.10 responsive images | Convert the actual Table preview PNG to an Astro asset with intrinsic dimensions and responsive variants. Leave consumer code examples unchanged. |
| Official RSS helper | Replace hand-written XML escaping, CDATA handling, and item serialization in `changelog.rss.ts` with `@astrojs/rss`. Keep our changelog parser and stable release links. This integration predates Astro 5. |
| Standard sitemap output | Point robots and search-engine submissions to the existing generated sitemap index and remove `copy-sitemap-index.mjs`, preserving the old sitemap URL with a redirect if needed. |
| Astro 6 Fonts API | Plan a site font-loading migration for preload and fallback management. Preserve the portable packages' CSS contract, theme switching, variable-font axes, and iframe fonts. This improves loading more than it deletes code. |

References: [typed environment variables](https://docs.astro.build/en/reference/modules/astro-env/),
[responsive images](https://astro.build/blog/astro-5100/),
[RSS](https://docs.astro.build/en/recipes/rss/),
[sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/), and
[fonts](https://docs.astro.build/en/guides/fonts/).

Native SVG components are useful for Astro-only artwork, but the current logo
is also passed into Preact JSX. Server islands, sessions, live collections, and
route caching become useful when there is personalized or request-time content
to serve. They would not remove the current browser search or editor logic.
Keep the prebuilt Playground boundary: the site guidance documents why ordinary
hydrated islands caused a large Monaco module graph during development.

### Recommended implementation order

1. Migrate Markdown to Sätteri, with output comparisons and browser regressions.
2. Consolidate the page catalog with the Content Layer and adopt the small
   environment-variable, RSS, sitemap, and responsive-image improvements.
3. Move site preparation into an Astro integration, retaining publishing entry
   points and the verified cache behavior.
4. Build and verify a Workers preview with the Cloudflare adapter, then migrate
   production and remove the Pages/chat deployment plumbing.
5. Evaluate font loading and collection-route incremental builds against the
   resulting architecture.

## Initial build optimizations (before native Markdown)

- Enabled MDX optimization while retaining unified and the existing plugins.
  Excluded `th` and `td`: static serialization emits `align` attributes instead
  of the inline alignment styles needed to override Anta's reset CSS.
- Added content-checked caches for API documentation, iframe assets, and
  Playground assets. Source changes, dependency changes, deleted or modified
  outputs, and Node runtime changes invalidate them. Failed builds cannot leave
  a reusable stamp. The cache is local to `site/.cache/build/`.
- Replaced the site's chain of `pnpm run` preparation commands with one Node
  coordinator. Independent preparation tasks run concurrently. The Playground
  waits for API data and the iframe manifest. Postprocessing waits for Astro.
- Removed CI's duplicate package builds. Workspace `prepare` scripts still
  build all three packages during installation, including on a clean output
  tree. Publishing lifecycle scripts remain unchanged.
- Added cache invalidation tests and a production browser regression covering
  Markdown table alignment and editing a Playground after ClientRouter navigation.

Force preparation with `ANTA_BUILD_CACHE=0 pnpm --filter anta-site build`.
Deleting the cache directory also forces preparation. These changes do not
enable Astro's experimental incremental builds or configure remote cache storage.

## Astro 5 through 7 feature decisions

Astro `7.3.3` remained the registry's latest stable version on September 17.
The following were the initial performance-only decisions. The broader review
above revises their priority when maintenance and framework adoption are goals.

| Feature | Decision |
| --- | --- |
| Astro 5 Content Layer | Defer. The site uses file-based MDX routes, not collections. Converting routes is a separate content-model change. |
| Server islands, Actions, and sessions available in Astro 5 | No migration in this pass. Static documentation and the separate search Worker do not need an Astro server runtime. |
| Astro 5 typed environment variables | No change in this pass. Validating optional analytics inputs would be separate configuration work, not a build-speed improvement. |
| Astro 5.1 remote image caching and 5.10 responsive images | Revisit for image-heavy pages. Current build time is dominated by compilation, and most image examples demonstrate consumer markup. |
| Astro 5.7 SVG components | Available for future Astro-only artwork. Shared Preact icons and logos also serve interactive components. |
| Astro 6 Fonts API | Defer. Font faces belong to the portable, switchable Anta themes. A site-only font migration must preserve theme changes and iframe font behavior. |
| Astro 6 CSP and improved Cloudflare runtime support | Separate work. CSP needs an audit of inline examples, Monaco workers, and preview iframes. Moving the static site to the Cloudflare adapter would change deployment architecture. |
| Astro 7 Rust compiler, Rolldown, and queued rendering | Already enabled by the framework defaults. |
| Astro 7 Sätteri Markdown/MDX processor | Defer until custom plugin behavior can be ported and verified. Keep unified for now. |
| Astro 7.2 incremental prerendering | Defer. No eligible keyed routes, and rendering is a small portion of the build. |
| Astro 7.3 performance and development fixes | Already included in the pinned version. Keep the root-owned foreground dev process. |
| MDX `optimize` | Adopted with table-cell exclusions. This option predates Astro 5 but remained disabled in this site. |

Sources: [Astro 5](https://astro.build/blog/astro-5/),
[5.1](https://astro.build/blog/astro-510/),
[5.7](https://astro.build/blog/astro-570/),
[5.10](https://astro.build/blog/astro-5100/),
[Astro 6](https://astro.build/blog/astro-6/),
[Astro 7](https://astro.build/blog/astro-7/),
[7.2](https://astro.build/blog/astro-720/),
[7.3](https://astro.build/blog/astro-730/), and
[MDX optimization](https://docs.astro.build/en/guides/integrations-guide/mdx/#optimize).

The original measurements and remaining proposals follow.

## September 17 validation and timings

Three paired local runs alternated the original site scripts and Astro config
from `db48d4c` with the optimized versions. Both used the same built production
packages, installed dependencies, Node `24.10.0`, and pnpm `10.11.1`. Each timing
covers `pnpm --filter anta-site build`, including preparation and postprocessing.
The new preparation cache was warmed before the paired runs.

| Run | Original build | Optimized build |
| --- | ---: | ---: |
| 1 | 24.45 s | 16.18 s |
| 2 | 24.07 s | 16.19 s |
| 3 | 23.87 s | 15.83 s |
| Median | 24.07 s | 16.18 s |

The median improved by 7.89 seconds, about 33%. This includes preparation-cache
reuse and MDX optimization. It does not measure the additional CI savings from
removing duplicate package builds. It is not a Cloudflare measurement, and the
local Node version differs from the deployment's `.node-version` pin.

The final configuration took 19.81 seconds with `ANTA_BUILD_CACHE=0`, forcing
all three cached preparation tasks to rebuild. Astro's own caches and installed
dependencies were still present. This was a single run, not a paired cold-cache
benchmark.

Validation completed during implementation:

- Removed package outputs, generated site manifests/API data, and preparation
  cache records, then ran a frozen install and production build successfully.
  Installation built Anta, stickers, and Plot once each through `prepare`.
- Passed all 179 root tests, including seven new cache tests covering source and
  lockfile changes, file additions/deletions, missing or modified outputs,
  failed builds, forced rebuilds, malformed records, and edits during a build.
- Passed package linting, all package type checks, Plot package verification,
  site CSS linting, and search-worker type checking.
- Passed three production browser tests covering search rendering and copy
  buttons, search navigation, aligned Markdown tables, ClientRouter navigation,
  and editing Monaco to recompile the preview.
- Compared 44 rendered main-content trees. Table alignment was the actionable
  MDX regression and was fixed. Generated asset URLs, renderer IDs, and some
  syntax-highlighting token boundaries can vary between builds.
- Started the root dev launcher, served `/button/` successfully, and stopped
  the process tree. The AI search Worker could not start its remote proxy
  without `CLOUDFLARE_API_TOKEN`. Production search tests use mocked responses.

## September 16 baseline measurements

The site build runs documentation generation, asset preparation, playground
bundling, Astro, search generation, and sitemap processing in sequence. See
[site scripts](site/package.json), [package scripts](package.json), and
[CI configuration](.github/workflows/ci.yml).

One local run measured the following wall-clock times, including each command's
package-manager startup overhead:

| Step | Seconds |
| --- | ---: |
| `docs:api` | 2.65 |
| `docs:pages` | 0.53 |
| `docs:llms-check` | 0.54 |
| `docs:wasm` | 0.54 |
| `docs:theme` | 0.53 |
| `docs:iframe-runtime` | 0.60 |
| `docs:playground-runtime` | 2.51 |
| `astro build` | 17.83 |
| `search:index` | 1.57 |
| `search:worker` | 0.57 |
| `sitemap:root` | 0.55 |
| Total | 28.52 |

This was a local run with dependencies installed and existing caches. It
excludes dependency installation, package builds, tests, and deployment upload.
It is not a Cloudflare Pages timing or a repeated benchmark.

Astro reported 16.27 seconds internally: about 11.17 seconds for the server
build, 3.36 seconds for the client build, and 1.41 seconds for page rendering.
It built 46 pages. Search indexing scanned 52 HTML pages, including redirects.

An earlier local build with Astro 5.18.1 reported 33.19 seconds internally.
Astro 7 runs reported roughly 16 seconds. Other dependencies and cache state
also changed, so this comparison does not isolate the effect of Astro itself.

## Improvements already supplied by the upgrade

Astro 7 enables Vite 8/Rolldown, the Rust Astro compiler, and its queued renderer
by default. These do not need additional experimental flags. Its native
Markdown/MDX processor, Sätteri, requires separate consideration because of our
plugins. See the [Astro 7 release notes](https://astro.build/blog/astro-7/).

The [Astro changelog](https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md)
also records recent rendering and large-module-graph performance fixes. Keep
the pinned version current through normal dependency updates and regression
checks before adding configuration intended for older releases.

## Original proposals and remaining work

### Build packages and generate documentation once

Implemented through the coordinator, API cache, and CI cleanup described above.
At baseline, installation ran the root `prepare` script to build Anta and
generate API documentation. CI explicitly built Anta again. The final site build
ran API documentation generation a third time. Sticker and Plot builds also
repeated between installation lifecycle scripts and explicit CI steps.

Give the build pipeline one owner for each output. Separate reusable package,
documentation, and site stages so downstream steps consume outputs already
produced in the same job. Preserve a standalone site-build command that creates
all its prerequisites.

Inspect the actual Cloudflare build command before applying the same change
there. The duplication above is confirmed in the repository's CI workflow.
Preserve package lifecycle behavior needed for publishing and local use. Do not
globally disable dependency install scripts without accounting for tools such
as esbuild and sharp.

Expected benefit: avoid repeated package compilation and documentation work.
The full savings need an end-to-end measurement. The 2.65-second API-generation
measurement alone does not include repeated package builds.

### Cache playground bundles when their inputs are unchanged

Implemented with local content-checked stamps. Remote cache storage remains
unconfigured.

[The playground build script](site/scripts/build-playground-runtime.mjs)
previously rebuilt Monaco, Shiki, the compiler runtime, and application code on
every run. Hashed output filenames supported browser caching but did not skip
compilation.

Add a cache keyed by the lockfile, relevant source files, bundler configuration,
and runtime/tool versions. Restore all required outputs on a hit and invalidate
the cache when any input changes. Measure restore overhead before enabling a
remote cache.

Expected benefit: skip some or most of the current 2.51-second stage on builds
whose playground inputs have not changed. Theme and asset changes must still
invalidate any outputs that embed them.

### Reduce command startup overhead and parallelize independent preparation

Implemented by `site/scripts/prepare.mjs`.

Several preparation commands take about half a second each, including their
`pnpm run` startup overhead. A single preparation driver could reduce repeated
process startup. Independent copy and bundling tasks may also run concurrently
after their prerequisites exist.

Keep dependency ordering explicit: API generation precedes generated pages,
package outputs precede consumers, and search indexing and sitemap processing
follow Astro. Benchmark this separately from caching so the savings can be
attributed to the change.

### Evaluate Sätteri as a separate migration

The site explicitly uses the unified compatibility processor to preserve its
remark/rehype plugins. Sätteri does not accept those plugins unchanged. See the
[processor introduction](https://astro.build/blog/astro-640/) and
[Astro 7 migration context](https://astro.build/blog/astro-7/).

Before switching, inventory and reproduce image/JSX unwrapping, table wrapping,
definition lists, attributes, math, and heading-link behavior. Check Expressive
Code output and the separate generated-documentation pipeline as well.

Compare rendered output and compilation time on representative documentation
pages. There is no measured speedup for our site yet. Treat this as a migration
with a benchmark, rather than a configuration-only optimization.

## Lower-priority options

### Incremental prerendering

Astro 7.2 introduced `experimental.incrementalBuild`. It caches prerendered
routes that use `getStaticPaths()` entries with `cacheKey`. Unkeyed routes are
rebuilt. Cache reuse also requires preserving Astro's cache directory, which
defaults to `node_modules/.astro`. See the
[7.2 release notes](https://astro.build/blog/astro-720/) and
[incremental-build documentation](https://docs.astro.build/en/reference/experimental-flags/incremental-build/).

The current site has no `getStaticPaths()` routes with cache keys. Simply
enabling the flag would not make its static pages eligible. Page rendering
takes only about 1.4 seconds, so avoid reorganizing the route structure solely
for this feature. Reconsider if route counts or rendering costs grow.

### Exclude generated stickers from Babel

The Preact integration processes large, already-compiled sticker modules and
emits Babel warnings for files over 500 kB. Its default exclusion of
`node_modules` does not exclude workspace-generated files.

A temporary config preserved `compat: true` and the `node_modules` exclusion,
then added an exclusion matching `/\/stickers\/dist\/generated\//`. A standalone
Astro build took 16.97 seconds, compared with the 17.83-second baseline. The
roughly 0.9-second difference is a single-run result and may include noise.

The experiment was removed. Repeat paired measurements before adopting it,
then verify sticker rendering and production bundles. Preserve the default
exclusions when providing custom options. See the
[Preact integration options](https://docs.astro.build/en/guides/integrations-guide/preact/).

### Features that do not address this build

Server-rendered route caching and session changes concern request-time work,
not this static site's build. Content-collection improvements are not an
immediate opportunity because the site does not define content collections.
The [7.1](https://astro.build/blog/astro-710/) and
[7.3](https://astro.build/blog/astro-730/) release posts did not identify a more
promising configuration change for the current build than the items above.

## Follow-up verification

For further changes, record cold and warm end-to-end timings, then repeat
paired baseline and candidate runs
under the same Node, pnpm, dependencies, and machine conditions. Report medians
and variation, and distinguish local measurements from CI and Cloudflare.

Check a clean checkout as well as cache hits. Change a package source file, a
documentation page, a playground source file, and the lockfile to verify that
each affected output rebuilds. Missing or stale generated files must not pass
because of artifacts left by a previous run.

Run the complete repository checks for broad orchestration changes. Verify
production search, generated documentation, code highlighting, math, stickers,
and the Monaco playground. Keep publishing prerequisites and the root
`pnpm run dev` workflow working.

## Original Cloudflare failure

The PR's original Cloudflare failure occurred during installation, before
Astro ran. `plot/package.json` specified Anta `0.3.27`, while the lockfile
specified `workspace:*`, causing `ERR_PNPM_OUTDATED_LOCKFILE`. The branch now
uses the workspace dependency consistently and bumps Anta to `0.3.30` for the
hooks Plot needs. Publish Anta before Plot, following
[the release instructions](RELEASING.md).

That install fix is separate from the deferred performance work. Local build
success does not establish a successful remote Cloudflare deployment.

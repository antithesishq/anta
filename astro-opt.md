# Astro build optimization findings

Recorded September 16, 2026, while updating PR #169 on branch `plot`.
The baseline is commit `a69849e`, with Astro pinned to `7.3.3`.

The original investigation was recorded on `plot` without implementing the
proposals. Follow-up implementation began September 17 on `perf/astro-build`,
based on `db48d4c`. PR #169 was still open when the new branch was created.

## Implemented on the optimization branch

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
The following decisions reflect this site's current architecture:

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

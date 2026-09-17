# Astro build optimization findings

Recorded September 16, 2026, while updating PR #169 on branch `plot`.
The baseline is commit `a69849e`, with Astro pinned to `7.3.3`.

These optimizations are deferred to a separate branch. This document records
the investigation and proposed follow-up work. The temporary performance
experiment was removed, and the normal production build passed afterward.

## Current build and measurements

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

## Proposed changes, in priority order

### Build packages and generate documentation once

Installation runs the root `prepare` script, which builds Anta and generates API
documentation. CI then explicitly builds Anta again. The final site build runs
API documentation generation a third time. Sticker and Plot builds also repeat
between installation lifecycle scripts and explicit CI steps.

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

[The playground build script](site/scripts/build-playground-runtime.mjs)
rebuilds Monaco, Shiki, the compiler runtime, and application code on every run.
Hashed output filenames support browser caching but do not skip compilation.

Add a cache keyed by the lockfile, relevant source files, bundler configuration,
and runtime/tool versions. Restore all required outputs on a hit and invalidate
the cache when any input changes. Measure restore overhead before enabling a
remote cache.

Expected benefit: skip some or most of the current 2.51-second stage on builds
whose playground inputs have not changed. Theme and asset changes must still
invalidate any outputs that embed them.

### Reduce command startup overhead and parallelize independent preparation

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

Implement the orchestration cleanup first, on a separate branch. Record cold
and warm end-to-end timings, then repeat paired baseline and candidate runs
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

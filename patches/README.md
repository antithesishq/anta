# Astro collection CSS ownership

`astro@7.3.3.patch` keeps CSS from client-only islands and processed scripts
attached to the collection entries that use them. Astro's unpatched build
traverses the content manifest when assigning these styles to pages, so even
metadata-only `getCollection()` calls can attach unrelated demo CSS.

The patch stops CSS ownership traversal at content asset boundaries and uses
Astro's existing stylesheet propagation when rendering an entry. Script
registration and execution retain Astro's existing behavior. Client stylesheets
needed by an entry stay available even when shared with server-rendered
components, so stylesheet inlining policy and relative asset URLs still work.

The patch is pinned in `pnpm-workspace.yaml`. When upgrading Astro, check whether
upstream fixes the ownership issue, remove or update the patch, and run a clean
site build followed by `pnpm --filter anta-site test:production`. Compare each
page's linked styles, including collection pages and standalone pages that read
their metadata. The production tests check Capture's unique CSS and the shared
element CSS used by Box, Capture, and Plot.

Incremental prerendering remains disabled. Evaluate client-only dependency
invalidation before enabling it; this patch does not extend Astro's incremental
dependency hashing to the new content-boundary ownership map.

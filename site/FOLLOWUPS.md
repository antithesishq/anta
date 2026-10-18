# Site follow-ups

Current build and development conventions live in [AGENTS.md](AGENTS.md).
Verify these opportunities against the current source before starting work.

## Deployment and browser setup

- Evaluate a Workers preview that consolidates the Pages search forwarder and
  separate chat Worker. Verify static delivery, custom domains, redirects,
  headers, preview bindings, streaming, limits, sanitization, and cancellation
  before changing production deployment.
- Evaluate Astro font loading while preserving theme switching, variable fonts,
  iframe synchronization, and application-owned package font choices.

## Smaller site improvements

- Declare the optional PostHog token through typed environment variables and
  omit analytics when it is unset.
- Evaluate standard sitemap-index output in place of the renaming postprocessor.
  Preserve the existing sitemap URL through a redirect if it changes.
- Use a responsive Astro asset for the Table preview image, preserving the
  consumer-facing markup examples.

## Performance investigations

- Measure remote Playground cache restore cost before adding remote storage.
  Local content-checked preparation caches already exist.
- Benchmark excluding generated sticker modules from Babel. Use paired cold and
  warm runs, then verify sticker rendering and production bundles.
- Follow [CSS ownership patch maintenance](../patches/README.md) before enabling
  incremental prerendering. Verify client-only asset invalidation first.

For build changes, record comparable cold and warm timings. Verify cache
invalidation after source, documentation, Playground, dependency, and missing
output changes. Follow the site verification commands in [AGENTS.md](AGENTS.md).

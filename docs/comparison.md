# Comparison

Compare four delivery models: styled React libraries, headless primitives,
copy-paste source, and framework-agnostic web components. Versions are a
snapshot from ; use each system's link for the current release.

Most systems are React-only and use CSS-in-JS, Sass, StyleX, or Tailwind.
Anta ships web components with plain CSS in one `@layer`, without a style
runtime. Consumer CSS overrides its defaults normally.

Browser years show the oldest published fixed floor. A dash means the system
uses a rolling policy or does not publish a versioned floor; its card gives the
full policy.

Fixed-package sizes are measured from the version named on each card. Each npm
artifact was downloaded, bundled as a full ESM import with esbuild, minified,
and gzipped. React and React DOM are external. When a library ships base CSS,
the total adds its separately gzipped CSS bundle. The line below each figure
states what it counts.

Tree-shaking, peer dependencies, icons, styles, and copied source still make
the numbers different shapes. Polaris is a dated CDN snapshot, not a
release-based package figure. Independently versioned packages and copied-source
systems need an explicit component boundary; each card names it. Every browser
version includes its release year. Rolling policies are pinned to the current
stable releases in this snapshot.

## Component coverage

Rows group components by job, so Dialog, Modal, and Drawer share one mark.
Anta covers the common controls but remains narrower than full suites. The
shadcn row reflects its default Base UI registry.

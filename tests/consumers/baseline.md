# Original consumer validation

These notes record the agent exercises that produced the saved fixtures. Rerun
the fixtures with `pnpm test:consumers`; use the root `AGENTS.md` procedure when
testing how new consumers interpret the documentation.

## Full bundle onboarding

Both agents independently chose `@antadesign/anta/bundle.css` and JSX imports
from `@antadesign/anta/bundle` after reading the installed package's installation
and component documentation. Their initial import choices worked unchanged.
Neither used repository source, workspace links, manual registration, or an
Anta source alias.

Next.js used the App Router, imported CSS in its root layout, and imported bundle
JS in a client component. Production Turbopack compilation, server rendering,
hydration, Button activation, and styling passed. Preact used the Vite preset's
`preact/compat` aliases; production compilation and pointer/Enter/Space Button
activation passed. Title and Tag remained unregistered in both frameworks.

The original apps used Anta 0.3.33, Node 24.10.0, npm 11.6.0, and Chrome
154.0.8037.98. Next.js was 16.3.8 with React/React DOM 19.3.0. Preact was
11.0.0 with Vite 8.3.2, `@preact/preset-vite` 2.10.6, and React 19.3.0 installed
for Anta's peer requirement. These framework versions are pinned in the fixtures.

Scaffold and assertion corrections included setting Next.js's package type to
`module`, adding an application favicon, and accounting for inline-flex
blockification inside flex/grid containers. None required changing Anta imports.

## Granular imports and JSX/UI separation

The basic granular apps used tokens/reset, separate Button/Title/Tag UI entries,
and JSX wrappers from the root package. Before the wrapper CSS change, root JSX
imports also introduced Breadcrumbs, Steps, InputDate, and shared Select CSS.
After commit `3df41a9`, the basic app's dependency graph contained none of those
composed styles.

The expanded Preact app validated Breadcrumbs, Steps, InputDate, Select, and
SelectFaceted through their explicit CSS-only UI entries and required primitives.
All five layouts and their tested interactions passed. Shared Select CSS appeared
once. These structural entries remained unregistered, and unrelated Slider was
absent.

Next.js validated granular Steps through Turbopack. Separate Webpack experiments
showed that root wrappers alone imported no Anta CSS, and `elements/a-steps`
alone imported only its JS entry and Steps CSS. Server markup, styles without
JavaScript, hydration, and Steps pointer/keyboard selection passed.

Two findings affected the saved checks:

- The Steps documentation initially omitted `elements/a-tooltip`. Unregistered
  generated tooltip text duplicated tab names. Adding that UI import fixed the
  app, and the package documentation was corrected.
- Playwright's selected-role filtering missed tab selection exposed through
  `ElementInternals`. The selected property, custom state, visible panel, and
  controlled application output worked. Chrome's accessibility tree also
  reported the tab as selected.

The final original runs reported no browser warnings, errors, failed requests,
or hydration failures. Saved fixtures now reproduce these checks against each
new local tarball; their reports are written under `.runs/`.

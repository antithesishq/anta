# Comparison

Compare four delivery models: styled React libraries, headless primitives,
copy-paste source, and framework-agnostic web components. Versions are a
snapshot from July 2026; use each system's link for the current release.

## Frameworks, styling, license, browser support

| System | Version | Frameworks | Styling | License | Browser baseline | Browser policy |
| --- | --- | --- | --- | --- | --- | --- |
| [Anta](https://anta.design) | @antadesign/anta 0.3.17 | React/Preact wrappers of Web components | Plain CSS + CSS-variable tokens | MIT | 2024 | Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS. |
| [MUI (Material UI)](https://mui.com/material-ui/) | @mui/material 9.2.0 | React | CSS-in-JS (Emotion) | MIT core + paid MUI X | 2023 | Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later. |
| [Mantine](https://mantine.dev) | @mantine/core 9.4.2 | React | CSS Modules + CSS variables | MIT | 2022 | Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later. |
| [Astryx](https://astryx.atmeta.com) | @astryxdesign/core 0.1.8 | React | StyleX (precompiled atomic CSS) | MIT | 2024 | Functional support: Chrome / Edge 114 (2024), Safari 17 (2023), and Firefox 125 (2024), or later. Its full-fidelity target is the rolling 2026 web baseline. |
| [Ant Design](https://ant.design) | antd 6.5.2 | React; Angular, Vue community ports | CSS-in-JS + CSS variables (v6) | MIT | ~2020 | v6 supports modern browsers and enables CSS variables by default. Its build transpiles against the rolling Browserslist `defaults` query, while shipped layout components use native `ResizeObserver` without a fallback, which reached all major engines in 2020. |
| [Gravity UI](https://gravity-ui.com) | @gravity-ui/uikit 7.47.1 | React | CSS (BEM classes) + CSS variables | MIT | 2025 | Web Baseline widely available on 1 January 2025, with downstream browsers. |
| [shadcn](https://ui.shadcn.com) + [Base UI](https://base-ui.com) + [Tailwind](https://tailwindcss.com) | Base UI registry @ 705ce59 | React; Vue, Svelte community ports | Tailwind + CSS variables | MIT | 2024 | Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. |
| [Untitled UI](https://www.untitledui.com/react) + [React Aria](https://react-spectrum.adobe.com/react-aria/) + [Tailwind](https://tailwindcss.com) | React app source @ eaee6a5 | React | Tailwind CSS + React Aria | MIT core + paid Pro tier | 2024 | Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements. |
| [Blueprint](https://blueprintjs.com) | @blueprintjs/core 6.17.2 | React | Sass-compiled CSS (bp6- classes) | Apache-2.0 | ~2023 | Blueprint publishes no current versioned floor and is desktop-first. Its current compiled core CSS uses `color-mix()`, which reached all major engines in 2023. |
| [Carbon](https://carbondesignsystem.com) | @carbon/react 1.112.0 | React + Lit web components; Angular, Vue, Svelte community | Sass + CSS variables | Apache-2.0 | ~2023 | Carbon supports the latest stable Edge, Firefox, Chrome, and Safari releases. Its shipped CSS uses `:has()` and container queries, which reached all major engines in 2023. |
| [Atlassian (Atlaskit)](https://atlassian.design) | @atlaskit/tokens 16.3.0 | React | Compiled CSS-in-JS + tokens | Apache-2.0 code, Atlassian-scoped terms | ~2022 | Atlaskit follows the browsers supported by Atlassian Cloud and publishes no fixed floor. Its current compiled controls use CSS variables and `:focus-visible`, which reached all major engines in 2022. |
| [Web Awesome](https://webawesome.com) | @awesome.me/webawesome 3.10.0 | Web components; React, Vue, Angular, Svelte guides | CSS framework + CSS variables | MIT core + paid Pro tier | ~2020 | Web Awesome officially supports the latest two major versions of Chrome, Safari, Edge, Firefox, and Opera. Its v3.10 production bundle targets ES2020; it does not publish a fixed browser floor. |
| [Shopify Polaris](https://shopify.dev/docs/api/app-home/web-components) | polaris.js CDN, always latest | Web components | Locked to the Shopify look | Restricted (Shopify apps) | ~2024 | Shopify does not publish a standalone floor for Polaris. The current CDN script uses `:has()`, container queries, and the Popover API; the last of those reached all major engines in 2024. |

Most systems are React-only and use CSS-in-JS, Sass, StyleX, or Tailwind.
Anta ships web components with plain CSS in one `@layer`, without a style
runtime. Consumer CSS overrides its defaults normally.

Browser years show the oldest published fixed floor. `~` marks the earliest
year shared by a browser feature the current system ships, rather than a
published support promise. Each browser value includes its policy and the feature
behind that estimate.

## The systems

Fixed-package sizes are measured from the version named on each card. Each npm
artifact was downloaded, bundled as a full ESM import with esbuild, minified,
and gzipped, then rounded up to the nearest 10 KiB. React and React DOM are
external. When a library ships base CSS, the total adds its separately gzipped
CSS bundle. The line below each figure states what it counts.

Tree-shaking, peer dependencies, icons, styles, and copied source still make
the numbers different shapes. Polaris is a dated CDN snapshot, not a
release-based package figure. Independently versioned packages and copied-source
systems need an explicit component boundary; each card names it. Every browser
version includes its release year. Rolling policies are pinned to the current
stable releases in this snapshot.

### Anta

[Anta](https://anta.design). Framework-agnostic web components with optional React/Preact wrappers and no style runtime.

| Field | Value |
| --- | --- |
| Version | @antadesign/anta 0.3.17 |
| Delivery | Styled web components + JSX wrappers |
| Gzipped size | ~100 KiB gzipped |
| Measurement scope | All JSX wrappers, custom elements, component CSS, tokens, and reset CSS; React, the branded theme, and stickers excluded. Selective imports are smaller. |
| Browser support | Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS. |

#### Strengths

- Runs in React, Preact, and plain HTML; JSX wrappers are optional.
- Components do not mutate host attributes, so they work with worker-thread and reactive renderers.
- Plain CSS in one @layer avoids a style runtime and specificity fights.
- Global tokens cover color roles, fonts, and focus. Components expose their remaining CSS variables locally.
- OKLCH tones use the same token system in light and dark mode.
- Per-element imports register only the component you use.

#### Trade-offs

- Young and small: about 20 components.
- Table and plotting libraries are planned companion packages.
- A 0.x release from one organization has a shorter track record than established systems.

### Web Awesome

[Web Awesome](https://webawesome.com). Font Awesome's framework-agnostic web components and CSS framework, succeeding Shoelace.

| Field | Value |
| --- | --- |
| Version | @awesome.me/webawesome 3.10.0 |
| Delivery | Styled web components |
| Gzipped size | ~190 KiB gzipped |
| Measurement scope | All free components, Lit runtime, and base CSS; Pro components and web fonts excluded. Selective imports are smaller. |
| Browser support | Web Awesome officially supports the latest two major versions of Chrome, Safari, Edge, Firefox, and Opera. Its v3.10 production bundle targets ES2020; it does not publish a fixed browser floor. |

#### Strengths

- Works in any stack or plain HTML without a build step.
- Broad components, utility and layout CSS, and Font Awesome icons.
- ElementInternals form controls support FormData, validation, and reset.
- CSS variables and `::part()` support theming.
- Backed by Font Awesome, with monthly releases since October 2025.

#### Trade-offs

- Combobox, date and file inputs, toasts, charts, and video require Pro.
- Lit is a runtime dependency alongside React or Vue.
- Its own docs describe SSR support as experimental.

### Shopify Polaris

[Shopify Polaris](https://shopify.dev/docs/api/app-home/web-components). Shopify's web-component system for apps that must match Shopify Admin.

| Field | Value |
| --- | --- |
| Version | polaris.js CDN, always latest |
| Delivery | Styled web components (CDN) |
| Gzipped size | ~120 KiB gzipped |
| Measurement scope | polaris.js on 31 July 2026; component CSS is embedded in the script. It appends 0.52 KiB-gzip Inter CSS, then loads a matching Inter WOFF2 subset (83.3 KiB Latin) and SVG icons on demand. The CDN is mutable. |
| Browser support | Shopify does not publish a standalone floor for Polaris. The current CDN script uses `:has()`, container queries, and the Popover API; the last of those reached all major engines in 2024. |

#### Strengths

- Framework-agnostic web components from a major platform.
- One script tag matches Shopify Admin and merchant brand settings.
- Shopify measured 40–85% smaller checkout-extension bundles after leaving React.
- Built-in accessibility warnings flag missing required props.

#### Trade-offs

- The CDN cannot be pinned; unannounced updates have broken production apps.
- Styling is intentionally locked to Shopify, not your own brand.
- It still lacks features from the deprecated React library, including bulk table selection and multi-select.
- The license applies only to apps that integrate with Shopify.

### MUI (Material UI)

[MUI (Material UI)](https://mui.com/material-ui/). Google's Material Design implementation for React, with extensive theming.

| Field | Value |
| --- | --- |
| Version | @mui/material 9.2.0 |
| Delivery | Styled React components |
| Gzipped size | ~170 KiB gzipped |
| Measurement scope | All Material UI core exports and the Emotion style runtime; React, icons, MUI X, date adapters, and application code excluded. Selective imports are smaller. |
| Browser support | Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later. |

#### Strengths

- A large component set, plus MUI X data grid, charts, and date pickers.
- The largest ecosystem here: documentation, themes, templates, and hiring.
- Themes reach component slots through `styleOverrides` and variants.
- v9 offers opt-in CSS-variable themes with OKLCH `color-mix()` states.

#### Trade-offs

- Moving far from Material requires slot-by-slot overrides; most MUI apps still read as Material.
- Emotion resolves styles at runtime. The planned zero-runtime Pigment CSS is paused.
- React-only; data grid, date-range pickers, and advanced charts have paid MUI X tiers.

### Ant Design

[Ant Design](https://ant.design). An enterprise React library for data-dense admin and dashboard UIs.

| Field | Value |
| --- | --- |
| Version | antd 6.5.2 |
| Delivery | Styled React components |
| Gzipped size | ~470 KiB gzipped |
| Measurement scope | All `antd` exports and its CSS-in-JS runtime; React, icons, charts, and application code excluded. Selective imports are smaller. |
| Browser support | v6 supports modern browsers and enables CSS variables by default. Its build transpiles against the rolling Browserslist `defaults` query, while shipped layout components use native `ResizeObserver` without a fallback, which reached all major engines in 2020. |

#### Strengths

- One of the largest component sets, including Table, Form, Transfer, and Cascader.
- Built for admin and data-heavy apps, often without a separate form library.
- Token-based themes include dark and compact modes.
- A mature ecosystem with Pro components, AntV charts, and TypeScript support.

#### Trade-offs

- Accessibility lacks a consolidated target and documentation; fixes land component by component.
- Imports need care to limit the icons, dayjs, and rc-component payload.
- Themes change color, radius, and density, but the result still reads as Ant Design.
- React-only; Vue and Angular versions are separate community projects.

### Mantine

[Mantine](https://mantine.dev). A React library with extensive hooks and official form, date, and chart packages.

| Field | Value |
| --- | --- |
| Version | @mantine/core 9.4.2 |
| Delivery | Styled React components |
| Gzipped size | ~210 KiB gzipped |
| Measurement scope | All `@mantine/core` exports, `@mantine/hooks`, and core CSS; React and separate dates, charts, forms, and notifications packages excluded. Selective imports are smaller. |
| Browser support | Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later. |

#### Strengths

- 142 components and 82 hooks; forms, dates, charts, notifications, and rich text are official packages.
- CSS Modules and CSS variables avoid runtime CSS-in-JS.
- Every component documents its Styles API, with unstyled and headless modes.
- Weekly patches, fast issue triage, and strong TypeScript documentation.

#### Trade-offs

- Current versions require React 19.2+; React 18 stays on v8.
- React-only.
- A full `@mantine/core` import with its required hooks and CSS is about 210 KiB gzipped, so tree-shaking matters.
- Development is largely led by one active, sponsor-funded maintainer.

### Carbon

[Carbon](https://carbondesignsystem.com). IBM's enterprise design system for React and first-party web components.

| Field | Value |
| --- | --- |
| Version | @carbon/react 1.112.0 |
| Delivery | Styled React (+ web components) |
| Gzipped size | ~300 KiB gzipped |
| Measurement scope | All `@carbon/react` exports and Carbon's compiled CSS; React, icons, charts, and web components excluded. Selective imports are smaller. |
| Browser support | Carbon supports the latest stable Edge, Firefox, Chrome, and Safari releases. Its shipped CSS uses `:has()` and container queries, which reached all major engines in 2023. |

#### Strengths

- Publishes component accessibility results, including manual screen-reader checks mapped to WCAG.
- Strong for data-dense enterprise UIs, with data-table and app-shell components.
- React and Lit web components ship first-party on the same release cadence.
- Theme-scoped role tokens support four built-in themes.

#### Trade-offs

- Component styles require Dart Sass; precompiled CSS covers only tokens, grid, and type.
- Moving away from IBM Plex requires Sass recompilation or many class overrides.
- Its large, multi-package surface has a matching learning curve.
- Angular, Vue, and Svelte implementations are community-maintained.

### Atlassian (Atlaskit)

[Atlassian (Atlaskit)](https://atlassian.design). The Jira, Confluence, and Trello system, published as independently versioned `@atlaskit` packages.

| Field | Value |
| --- | --- |
| Version | @atlaskit/tokens 16.3.0 |
| Delivery | Styled React components |
| Gzipped size | ~600 KiB gzipped |
| Measurement scope | 57 public Design System packages; tables, icons, editors, product packages, and React excluded. Only imported packages ship. |
| Browser support | Atlaskit follows the browsers supported by Atlassian Cloud and publishes no fixed floor. Its current compiled controls use CSS variables and `:focus-visible`, which reached all major engines in 2022. |

#### Strengths

- Proven in Atlassian products, with tokens and Figma libraries aligned to the code.
- Build-time Compiled CSS-in-JS keeps the style runtime near zero.
- Deep collaboration patterns, including pragmatic drag and drop.
- A WCAG 2.1 AA target with published conformance reports.

#### Trade-offs

- You must keep dozens of `@atlaskit` package versions aligned.
- Compiled CSS-in-JS needs Babel or SWC and style extraction setup.
- Terms limit use to products that integrate with Atlassian, and the docs assume that context.
- React-only.

### Blueprint

[Blueprint](https://blueprintjs.com). Palantir's React toolkit for complex, data-dense desktop interfaces.

| Field | Value |
| --- | --- |
| Version | @blueprintjs/core 6.17.2 |
| Delivery | Styled React components |
| Gzipped size | ~350 KiB gzipped |
| Measurement scope | All `@blueprintjs/core` exports and compiled core CSS; React and the separate Table, Select, and Datetime packages excluded. Selective imports are smaller. |
| Browser support | Blueprint publishes no current versioned floor and is desktop-first. Its current compiled core CSS uses `color-mix()`, which reached all major engines in 2023. |

#### Strengths

- Built for dense desktop tools: a virtualized Table, Omnibar, and dual-calendar date picker.
- Maintained by a Palantir team and in production there since 2016.
- Thorough documentation and consistent keyboard behavior.

#### Trade-offs

- Desktop-first by design; touch and mobile are out of scope.
- Restyling requires Sass recompilation or `bp6-` class overrides; dark mode is a class toggle.
- React-only.

### Astryx

[Astryx](https://astryx.atmeta.com). Meta's React design system on StyleX, with precompiled CSS and first-party AI-agent tooling.

| Field | Value |
| --- | --- |
| Version | @astryxdesign/core 0.1.8 |
| Delivery | Styled React components |
| Gzipped size | ~260 KiB gzipped |
| Measurement scope | All core exports, StyleX runtime, and `astryx.css`; React excluded. Selective source builds are smaller. |
| Browser support | Functional support: Chrome / Edge 114 (2024), Safari 17 (2023), and Firefox 125 (2024), or later. Its full-fidelity target is the rolling 2026 web baseline. |

#### Strengths

- About 100 stable components, including an enterprise Table and WebGL chart primitive.
- Precompiled CSS needs no StyleX build step; source compilation is optional for tree-shaking.
- Agent tooling includes an MCP server, `llms.txt`, and a CLI for context files and source ejection.
- Developed within Meta before the June 2026 public release, with frequent updates since.

#### Trade-offs

- Custom brand tokens do not reach every component; some fall back to Astryx defaults.
- React-only, and requires React 19.
- Accessibility work appears in releases, but there is no conformance statement or external audit yet.

### Gravity UI

[Gravity UI](https://gravity-ui.com). Yandex's open-source React system, with `@gravity-ui` packages, Figma, and Storybook.

| Field | Value |
| --- | --- |
| Version | @gravity-ui/uikit 7.47.1 |
| Delivery | Styled React components |
| Gzipped size | ~220 KiB gzipped |
| Measurement scope | All UIKit exports and UIKit CSS; React, icons, dates, charts, and data-table packages excluded. Selective imports are smaller. |
| Browser support | Web Baseline widely available on 1 January 2025, with downstream browsers. |

#### Strengths

- A broad core plus packages for dates, icons, charts, navigation, and a headless data table.
- Built-in light, dark, and high-contrast themes, with CSS variables and a hosted theme editor.
- Screen-reader audits drive documented keyboard and focus fixes.
- Supports React 16.14 through 19 in one release.

#### Trade-offs

- React-only.
- Dates, charts, and the data table add separate dependencies.
- There is little verified adoption outside Yandex products.

### shadcn + Base UI + Tailwind

[shadcn](https://ui.shadcn.com) + [Base UI](https://base-ui.com) + [Tailwind](https://tailwindcss.com). Tailwind-styled source copied into your repo by CLI, using Base UI primitives by default.

| Field | Value |
| --- | --- |
| Version | Base UI registry @ 705ce59 |
| Delivery | Copy-paste React source on Base UI |
| Gzipped size | ~350 KiB gzipped |
| Measurement scope | All 61 Base UI registry components and generated Tailwind CSS; React and Lucide excluded. Only selected source ships. |
| Browser support | Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. |

#### Strengths

- The source lives in your repo, with no black-box dependency or version lock.
- Base UI supplies accessible, composable primitives with a render-prop API.
- AI tools such as v0 and Cursor commonly generate shadcn-style code.
- A large ecosystem of themes, blocks, and community registries.

#### Trade-offs

- Tailwind is required; generated components use utility classes throughout.
- Upstream fixes require manual diffs, especially after local edits.
- You own consistency across copied files, and registry quality varies.

### Untitled UI + React Aria + Tailwind

[Untitled UI](https://www.untitledui.com/react) + [React Aria](https://react-spectrum.adobe.com/react-aria/) + [Tailwind](https://tailwindcss.com). A large React and Tailwind source collection on React Aria, paired with the Untitled UI Figma kit.

| Field | Value |
| --- | --- |
| Version | React app source @ eaee6a5 |
| Delivery | Copy-paste React source |
| Gzipped size | ~410 KiB gzipped |
| Measurement scope | 102 app source files (`base` + `application`), React Aria, and generated Tailwind CSS; React, Next, and icons excluded. Only selected source ships. |
| Browser support | Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements. |

#### Strengths

- A broad React Aria component set copied into your repo without a runtime dependency.
- Tailwind v4 styling and a synced Figma kit keep design and code aligned.
- Charts use Recharts rather than native chart components.

#### Trade-offs

- React-only, with React 19 and Tailwind CSS 4 required.
- Tables render as regular HTML tables with horizontal scrolling, not virtualized data grids.
- Full-page examples, extra icon styles, and the Figma kit require paid tiers.
- You own consistency and upgrades across copied files.

## Component coverage

Rows group components by job, so Dialog, Modal, and Drawer share one mark.
Anta covers the common controls but remains narrower than full suites. The
shadcn row reflects its default Base UI registry.

Utility containers include general-purpose boxes, observers, and scroll or input
utilities. Focus management includes standalone APIs for focus indicators,
trapping, and navigation.

| Component category | [Anta](https://anta.design) | [MUI (Material UI)](https://mui.com/material-ui/) | [Mantine](https://mantine.dev) | [Astryx](https://astryx.atmeta.com) | [Ant Design](https://ant.design) | [Gravity UI](https://gravity-ui.com) | [shadcn](https://ui.shadcn.com) + [Base UI](https://base-ui.com) + [Tailwind](https://tailwindcss.com) | [Untitled UI](https://www.untitledui.com/react) + [React Aria](https://react-spectrum.adobe.com/react-aria/) + [Tailwind](https://tailwindcss.com) | [Blueprint](https://blueprintjs.com) | [Carbon](https://carbondesignsystem.com) | [Atlassian (Atlaskit)](https://atlassian.design) | [Web Awesome](https://webawesome.com) | [Shopify Polaris](https://shopify.dev/docs/api/app-home/web-components) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button: Button, icon button, group | [Included](./components/button.md) | [Included](https://mui.com/material-ui/react-button/) | [Included](https://mantine.dev/core/button/) | [Included](https://astryx.atmeta.com/components/Button) | [Included](https://ant.design/components/button) | [Included](https://gravity-ui.com/components/uikit/button) | [Included](https://ui.shadcn.com/docs/components/button) | [Included](https://www.untitledui.com/react/components/buttons) | [Included](https://blueprintjs.com/docs/#core/components/button) | [Included](https://carbondesignsystem.com/components/button/usage/) | [Included](https://atlassian.design/components/button/examples) | [Included](https://webawesome.com/docs/components/button/) | [Included](https://shopify.dev/docs/api/app-home/web-components/actions/button) |
| Text input: Text, number, password, textarea | [Included](./components/input.md) | [Included](https://mui.com/material-ui/react-text-field/) | [Included](https://mantine.dev/core/text-input/) | [Included](https://astryx.atmeta.com/components/TextInput) | [Included](https://ant.design/components/input) | [Included](https://gravity-ui.com/components/uikit/text-input) | [Included](https://ui.shadcn.com/docs/components/input) | [Included](https://www.untitledui.com/react/components/inputs) | [Included](https://blueprintjs.com/docs/#core/components/input-group) | [Included](https://carbondesignsystem.com/components/text-input/usage/) | [Included](https://atlassian.design/components/textfield/examples) | [Included](https://webawesome.com/docs/components/input/) | [Included](https://shopify.dev/docs/api/app-home/web-components/forms/text-field) |
| Select: Single/multi dropdown select | [Included](./components/select.md) | [Included](https://mui.com/material-ui/react-select/) | [Included](https://mantine.dev/core/select/) | [Included](https://astryx.atmeta.com/components/Selector) | [Included](https://ant.design/components/select) | [Included](https://gravity-ui.com/components/uikit/select) | [Included](https://ui.shadcn.com/docs/components/select) | [Included](https://www.untitledui.com/react/components/select) | [Included](https://blueprintjs.com/docs/#select/select-component) | [Included](https://carbondesignsystem.com/components/dropdown/usage/) | [Included](https://atlassian.design/components/select/examples) | [Included](https://webawesome.com/docs/components/select/) | [Included](https://shopify.dev/docs/api/app-home/web-components/forms/select) |
| Combobox: Autocomplete, searchable select | [Included](./components/input-autocomplete.md) | [Included](https://mui.com/material-ui/react-autocomplete/) | [Included](https://mantine.dev/core/autocomplete/) | [Included](https://astryx.atmeta.com/components/Typeahead) | [Included](https://ant.design/components/auto-complete) | [Basic or community-only](https://gravity-ui.com/components/uikit/select) | [Included](https://ui.shadcn.com/docs/components/combobox) | [Included](https://www.untitledui.com/react/components/select) | [Included](https://blueprintjs.com/docs/#select/suggest) | [Included](https://carbondesignsystem.com/components/dropdown/usage/) | [Basic or community-only](https://atlassian.design/components/select/async-select/examples) | [Paid tier](https://webawesome.com/docs/components/combobox/) | Not shipped |
| Checkbox / Radio / Switch: Toggles and choice groups | [Included](./components/checkbox.md) | [Included](https://mui.com/material-ui/react-checkbox/) | [Included](https://mantine.dev/core/checkbox/) | [Included](https://astryx.atmeta.com/components/CheckboxInput) | [Included](https://ant.design/components/checkbox) | [Included](https://gravity-ui.com/components/uikit/checkbox) | [Included](https://ui.shadcn.com/docs/components/checkbox) | [Included](https://www.untitledui.com/react/components/checkboxes) | [Included](https://blueprintjs.com/docs/#core/components/checkbox) | [Included](https://carbondesignsystem.com/components/checkbox/usage/) | [Included](https://atlassian.design/components/checkbox/examples) | [Included](https://webawesome.com/docs/components/checkbox/) | [Included](https://shopify.dev/docs/api/app-home/web-components/forms/checkbox) |
| Slider: Range / value slider | [Included](./components/slider.md) | [Included](https://mui.com/material-ui/react-slider/) | [Included](https://mantine.dev/core/slider/) | [Included](https://astryx.atmeta.com/components/Slider) | [Included](https://ant.design/components/slider) | [Included](https://gravity-ui.com/components/uikit/slider) | [Included](https://ui.shadcn.com/docs/components/slider) | [Included](https://www.untitledui.com/react/components/sliders) | [Included](https://blueprintjs.com/docs/#core/components/sliders) | [Included](https://carbondesignsystem.com/components/slider/usage/) | [Included](https://atlassian.design/components/range/examples) | [Included](https://webawesome.com/docs/components/slider/) | Not shipped |
| Date & time: Calendar, date/time picker | [Included](./components/input-date.md) | [Included](https://mui.com/x/react-date-pickers/) | [Included](https://mantine.dev/dates/date-picker-input/) | [Included](https://astryx.atmeta.com/components/DateInput) | [Included](https://ant.design/components/date-picker) | [Basic or community-only](https://gravity-ui.com/components/date-components/date-picker) | [Included](https://ui.shadcn.com/docs/components/date-picker) | [Included](https://www.untitledui.com/react/components/date-pickers) | [Included](https://blueprintjs.com/docs/#datetime/date-picker) | [Included](https://carbondesignsystem.com/components/date-picker/usage/) | [Included](https://atlassian.design/components/datetime-picker/examples) | [Paid tier](https://webawesome.com/docs/components/date-picker/) | [Included](https://shopify.dev/docs/api/app-home/web-components/forms/date-picker) |
| Tabs: Tab strip + panels | [Included](./components/tabs.md) | [Included](https://mui.com/material-ui/react-tabs/) | [Included](https://mantine.dev/core/tabs/) | [Included](https://astryx.atmeta.com/components/TabList) | [Included](https://ant.design/components/tabs) | [Included](https://gravity-ui.com/components/uikit/tabs) | [Included](https://ui.shadcn.com/docs/components/tabs) | [Included](https://www.untitledui.com/react/components/tabs) | [Included](https://blueprintjs.com/docs/#core/components/tabs) | [Included](https://carbondesignsystem.com/components/tabs/usage/) | [Included](https://atlassian.design/components/tabs/examples) | [Included](https://webawesome.com/docs/components/tab-group/) | Included |
| Menu: Dropdown, context, menubar | [Included](./components/menu.md) | [Included](https://mui.com/material-ui/react-menu/) | [Included](https://mantine.dev/core/menu/) | [Included](https://astryx.atmeta.com/components/DropdownMenu) | [Included](https://ant.design/components/menu) | [Included](https://gravity-ui.com/components/uikit/dropdown-menu) | [Included](https://ui.shadcn.com/docs/components/dropdown-menu) | [Included](https://www.untitledui.com/react/components/dropdowns) | [Included](https://blueprintjs.com/docs/#core/components/menu) | [Included](https://carbondesignsystem.com/components/overflow-menu/usage/) | [Included](https://atlassian.design/components/menu/examples) | [Included](https://webawesome.com/docs/components/dropdown/) | [Included](https://shopify.dev/docs/api/app-home/web-components/actions/menu) |
| Tooltip / Popover: Hover + click surfaces | [Included](./components/tooltip.md) | [Included](https://mui.com/material-ui/react-tooltip/) | [Included](https://mantine.dev/core/tooltip/) | [Included](https://astryx.atmeta.com/components/Tooltip) | [Included](https://ant.design/components/tooltip) | [Included](https://gravity-ui.com/components/uikit/tooltip) | [Included](https://ui.shadcn.com/docs/components/tooltip) | [Included](https://www.untitledui.com/react/components/tooltips) | [Included](https://blueprintjs.com/docs/#core/components/tooltip) | [Included](https://carbondesignsystem.com/components/tooltip/usage/) | [Included](https://atlassian.design/components/tooltip/examples) | [Included](https://webawesome.com/docs/components/tooltip/) | [Included](https://shopify.dev/docs/api/app-home/web-components/typography-and-content/tooltip) |
| Dialog: Modal, drawer, sheet | [Included](./components/dialog.md) | [Included](https://mui.com/material-ui/react-dialog/) | [Included](https://mantine.dev/core/modal/) | [Included](https://astryx.atmeta.com/components/Dialog) | [Included](https://ant.design/components/modal) | [Included](https://gravity-ui.com/components/uikit/modal) | [Included](https://ui.shadcn.com/docs/components/dialog) | [Included](https://www.untitledui.com/react/components/modals) | [Included](https://blueprintjs.com/docs/#core/components/dialog) | [Basic or community-only](https://carbondesignsystem.com/components/modal/usage/) | [Included](https://atlassian.design/components/modal-dialog/examples) | [Included](https://webawesome.com/docs/components/dialog/) | [Basic or community-only](https://shopify.dev/docs/api/app-home/web-components/overlays/modal) |
| Notification: Toast, banner, inline alert | [Included](./components/toaster.md) | [Included](https://mui.com/material-ui/react-snackbar/) | [Included](https://mantine.dev/x/notifications/) | [Included](https://astryx.atmeta.com/components/Toast) | [Included](https://ant.design/components/message) | [Included](https://gravity-ui.com/components/uikit/toaster) | [Included](https://ui.shadcn.com/docs/components/sonner) | [Paid tier](https://www.untitledui.com/react/components/notifications) | [Included](https://blueprintjs.com/docs/#core/components/toast) | [Included](https://carbondesignsystem.com/components/notification/usage/) | [Included](https://atlassian.design/components/flag/examples) | [Paid tier](https://webawesome.com/docs/components/toast/) | [Basic or community-only](https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/banner) |
| Expander: Disclosure / Accordion | [Included](./components/expander.md) | [Included](https://mui.com/material-ui/react-accordion/) | [Included](https://mantine.dev/core/accordion/) | [Included](https://astryx.atmeta.com/components/Collapsible) | [Included](https://ant.design/components/collapse) | [Included](https://gravity-ui.com/components/uikit/disclosure) | [Included](https://ui.shadcn.com/docs/components/accordion) | [Paid tier](https://www.untitledui.com/react/marketing/faq-sections/faq-accordion-04-brand) | [Included](https://blueprintjs.com/docs/#core/components/collapse) | [Included](https://carbondesignsystem.com/components/accordion/usage/) | Not shipped | [Included](https://webawesome.com/docs/components/accordion/) | Not shipped |
| Table: Table / data grid | [Basic or community-only](./packages/table.md) | [Included](https://mui.com/material-ui/react-table/) | [Basic or community-only](https://mantine.dev/core/table/) | [Included](https://astryx.atmeta.com/components/Table) | [Included](https://ant.design/components/table) | [Included](https://gravity-ui.com/components/uikit/table) | [Included](https://ui.shadcn.com/docs/components/table) | [Included](https://www.untitledui.com/react/components/tables) | [Included](https://blueprintjs.com/docs/#table) | [Included](https://carbondesignsystem.com/components/data-table/usage/) | [Included](https://atlassian.design/components/dynamic-table/examples) | Not shipped | [Included](https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/table) |
| Tag / Badge: Tag, badge, chip, lozenge | [Included](./components/tag.md) | [Included](https://mui.com/material-ui/react-chip/) | [Included](https://mantine.dev/core/badge/) | [Included](https://astryx.atmeta.com/components/Badge) | [Included](https://ant.design/components/tag) | [Included](https://gravity-ui.com/components/uikit/label) | [Included](https://ui.shadcn.com/docs/components/badge) | [Included](https://www.untitledui.com/react/components/tags) | [Included](https://blueprintjs.com/docs/#core/components/tag) | [Included](https://carbondesignsystem.com/components/tag/usage/) | [Included](https://atlassian.design/components/tag/examples) | [Included](https://webawesome.com/docs/components/tag/) | [Included](https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/badge) |
| Progress: Bar, spinner, skeleton | [Included](./components/progress.md) | [Included](https://mui.com/material-ui/react-progress/) | [Included](https://mantine.dev/core/progress/) | [Included](https://astryx.atmeta.com/components/ProgressBar) | [Included](https://ant.design/components/progress) | [Included](https://gravity-ui.com/components/uikit/progress) | [Included](https://ui.shadcn.com/docs/components/progress) | [Included](https://www.untitledui.com/react/components/progress-indicators) | [Included](https://blueprintjs.com/docs/#core/components/progress-bar) | [Included](https://carbondesignsystem.com/components/progress-bar/usage/) | [Included](https://atlassian.design/components/progress-bar/examples) | [Included](https://webawesome.com/docs/components/progress-bar/) | [Basic or community-only](https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/spinner) |
| Avatar: Avatar / avatar group | [Included](./components/avatar.md) | [Included](https://mui.com/material-ui/react-avatar/) | [Included](https://mantine.dev/core/avatar/) | [Included](https://astryx.atmeta.com/components/Avatar) | [Included](https://ant.design/components/avatar) | [Included](https://gravity-ui.com/components/uikit/avatar) | [Included](https://ui.shadcn.com/docs/components/avatar) | [Included](https://www.untitledui.com/react/components/avatars) | Not shipped | Not shipped | [Included](https://atlassian.design/components/avatar/examples) | [Included](https://webawesome.com/docs/components/avatar/) | [Included](https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/avatar) |
| Card: Card / tile / surface | [Included](./components/card.md) | [Included](https://mui.com/material-ui/react-card/) | [Included](https://mantine.dev/core/card/) | [Included](https://astryx.atmeta.com/components/Card) | [Included](https://ant.design/components/card) | [Included](https://gravity-ui.com/components/uikit/card) | [Included](https://ui.shadcn.com/docs/components/card) | Not shipped | [Included](https://blueprintjs.com/docs/#core/components/card) | [Included](https://carbondesignsystem.com/components/tile/usage/) | Basic or community-only | [Included](https://webawesome.com/docs/components/card/) | [Included](https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/section) |
| Steps: Stepper, wizard, progress tracker | [Included](./components/steps.md) | [Included](https://mui.com/material-ui/react-stepper/) | [Included](https://mantine.dev/core/stepper/) | Not shipped | [Included](https://ant.design/components/steps) | [Included](https://gravity-ui.com/components/uikit/stepper) | Basic or community-only | [Paid tier](https://www.untitledui.com/react/components/progress-steps) | Not shipped | [Included](https://carbondesignsystem.com/components/progress-indicator/usage/) | [Included](https://atlassian.design/components/progress-tracker/examples) | Not shipped | Not shipped |
| Breadcrumbs: Breadcrumb navigation | [Included](./components/breadcrumbs.md) | [Included](https://mui.com/material-ui/react-breadcrumbs/) | [Included](https://mantine.dev/core/breadcrumbs/) | [Included](https://astryx.atmeta.com/components/Breadcrumbs) | [Included](https://ant.design/components/breadcrumb) | [Included](https://gravity-ui.com/components/uikit/breadcrumbs) | [Included](https://ui.shadcn.com/docs/components/breadcrumb) | [Paid tier](https://www.untitledui.com/react/components/breadcrumbs) | [Included](https://blueprintjs.com/docs/#core/components/breadcrumbs) | [Included](https://carbondesignsystem.com/components/breadcrumb/usage/) | [Included](https://atlassian.design/components/breadcrumbs/examples) | [Included](https://webawesome.com/docs/components/breadcrumb/) | Not shipped |
| Icons: Bundled icon set | [Included](./components/icon.md) | [Included](https://mui.com/material-ui/material-icons/) | [Basic or community-only](https://mantine.dev/guides/icons/) | [Included](https://astryx.atmeta.com/components/Icon) | [Included](https://ant.design/components/icon) | [Included](https://gravity-ui.com/components/uikit/icon) | Basic or community-only | [Included](https://www.untitledui.com/react/docs/icons) | [Included](https://blueprintjs.com/docs/#core/components/icon) | [Included](https://carbondesignsystem.com/elements/icons/usage/) | [Included](https://atlassian.design/components/icon/examples) | [Included](https://webawesome.com/docs/components/icon/) | [Included](https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/icon) |
| Typography: Text / title components | [Included](./components/text.md) | [Included](https://mui.com/material-ui/react-typography/) | [Included](https://mantine.dev/core/typography/) | [Included](https://astryx.atmeta.com/components/Text) | [Included](https://ant.design/components/typography) | [Included](https://gravity-ui.com/components/uikit/text) | Not shipped | [Included](https://www.untitledui.com/react/docs/typography) | [Basic or community-only](https://blueprintjs.com/docs/#core/typography) | [Basic or community-only](https://carbondesignsystem.com/elements/typography/overview/) | [Basic or community-only](https://atlassian.design/components/heading/examples) | [Basic or community-only](https://webawesome.com/docs/tokens/typography/) | [Included](https://shopify.dev/docs/api/app-home/web-components/typography-and-content/text) |
| Charts: First-party data viz | Not shipped | [Included](https://mui.com/x/react-charts/) | [Included](https://mantine.dev/charts/getting-started/) | Basic or community-only | [Included](https://charts.ant.design/en) | Basic or community-only | [Included](https://ui.shadcn.com/charts) | [Included](https://www.untitledui.com/react/components/line-bar-charts) | Not shipped | [Included](https://charts.carbondesignsystem.com/) | Not shipped | [Paid tier](https://webawesome.com/docs/components/chart/) | Not shipped |
| Utility containers: Boxes with observers, scroll, and input | [Included (Box, Capture)](./components/box.md) | [Included (ClickAwayListener)](https://mui.com/material-ui/react-click-away-listener/) | [Included (useResizeObserver)](https://mantine.dev/hooks/use-resize-observer/) | [Included (useScrollOverflow)](https://astryx.atmeta.com/components/useScrollOverflow) | Not shipped | [Included (useResizeObserver)](https://github.com/gravity-ui/uikit/tree/main/src/hooks/useResizeObserver) | [Included (Scroll Area)](https://ui.shadcn.com/docs/components/scroll-area) | [Included (React Aria useMove)](https://react-aria.adobe.com/useMove) | [Included (ResizeSensor)](https://blueprintjs.com/docs/#core/components/resize-sensor) | Not shipped | [Included (Pragmatic drag and drop)](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/) | [Included (Resize Observer)](https://webawesome.com/docs/components/resize-observer/) | [Included (Box (responsive styling and accessibility))](https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/box) |
| Focus management: Focus detection and traps | Not shipped | [Included (Unstable_TrapFocus (experimental))](https://github.com/mui/material-ui/tree/master/packages/mui-material/src/Unstable_TrapFocus) | [Included (FocusTrap, useFocusTrap)](https://mantine.dev/core/focus-trap/) | [Included (useFocusTrap, useListFocus)](https://astryx.atmeta.com/components/useFocusTrap) | Not shipped | Not shipped | Not shipped | [Included (React Aria FocusScope, useFocusManager)](https://react-aria.adobe.com/FocusScope) | [Included (FocusStyleManager (focus indicators))](https://github.com/palantir/blueprint/blob/develop/packages/core/src/accessibility/focusStyleManager.ts) | Not shipped | Not shipped | Not shipped | Not shipped |

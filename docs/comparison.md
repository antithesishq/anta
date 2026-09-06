# Comparison

<a id="frameworks-styling-license-browser-support"></a>

## Frameworks, styling, licenses, and browser support

| System | Version | Frameworks | Styling | License | Browser baseline | Browser policy |
| --- | --- | --- | --- | --- | --- | --- |
| [Anta](https://anta.design) | @antadesign/anta 0.3.26 | Web components; React and Preact wrappers | Plain CSS + CSS-variable tokens | MIT | 2024 | Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS. |
| [MUI (Material UI)](https://mui.com/material-ui/) | @mui/material 9.4.0 | React | CSS-in-JS (Emotion) | MIT core + paid MUI X | 2024 | Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later. |
| [Mantine](https://mantine.dev) | @mantine/core 9.6.0 | React | CSS Modules + CSS variables | MIT | 2022 | Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later. |
| [Astryx](https://astryx.atmeta.com) | @astryxdesign/core 0.5.3 | React | StyleX (precompiled atomic CSS) | MIT | 2024 / 2026 | Two documented tiers: functional support at Baseline 2024 and full fidelity at Baseline 2026. Older functional-tier browsers need a positioning fallback for anchored overlays. |
| [Ant Design](https://ant.design) | antd 6.6.2 | React; Angular, Vue community ports | CSS-in-JS + CSS variables (v6) | MIT | ~2023 | Estimated compatibility: Chrome / Edge 111+, Firefox 121+, and Safari 16.2+ (2023), based on :has(), color-mix(), and ResizeObserver in current components. Ant Design officially targets modern browsers; some enhancements can require newer versions. |
| [Gravity UI](https://gravity-ui.com) | @gravity-ui/uikit 7.49.0 | React | CSS (BEM classes) + CSS variables | MIT | ~2023 | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 15.4+ (2023), based on :has() in theme CSS, Array.at() in tabs and tables, and ResizeObserver. Extension packages can add requirements. |
| [shadcn](https://ui.shadcn.com) + [Base UI](https://base-ui.com) + [Tailwind](https://tailwindcss.com) | Base UI registry | React; Vue, Svelte community ports | Tailwind + CSS variables | MIT | 2024 | Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. |
| [Untitled UI](https://www.untitledui.com/react) + [React Aria](https://react-spectrum.adobe.com/react-aria/) + [Tailwind](https://tailwindcss.com) | React app source | React | Tailwind CSS + React Aria | MIT core + paid Pro tier | 2024 | Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements. |
| [Blueprint](https://blueprintjs.com) | @blueprintjs/core 6.18.0 | React | Sass-compiled CSS (bp6- classes) | Apache-2.0 | ~2023 | Estimated compatibility: Chrome / Edge 111+, Firefox 113+, and Safari 16.2+ (2023), based on color-mix() in core CSS. Relative-color enhancements have fallbacks. The repository maintains a rolling Browserslist target. |
| [Carbon](https://carbondesignsystem.com) | @carbon/react 1.115.0 | React + Lit web components; Angular, Vue, Svelte community | Sass + CSS variables | Apache-2.0 | ~2023 | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16+ (2023), based on :has() and container queries in the shipped CSS. Official support covers the latest stable browser releases. |
| [Atlassian (Atlaskit)](https://atlassian.design) | @atlaskit/tokens 16.11.2 | React | Compiled CSS-in-JS + tokens | Package-specific OSS + ADS terms | ~2022 | Estimated compatibility for compiled controls: Chrome / Edge 86+, Firefox 85+, and Safari 15.4+ (2022), based on CSS variables and :focus-visible. Other packages can require newer features. Official support follows the target Atlassian product. |
| [Web Awesome](https://webawesome.com) | @awesome.me/webawesome 3.12.0 | Web components; React, Vue, Angular, Svelte guides | CSS framework + CSS variables | MIT core + paid Pro tier | ~2024 | Estimated compatibility: Chrome / Edge 125+, Firefox 128+, and Safari 18+ (2024). Current styles use custom states and relative OKLCH colors. Official support covers the latest two major browser versions. |
| [Shopify Polaris](https://shopify.dev/docs/api/app-home/web-components) | Polaris CDN 1.x; 1.1 RC | Web components | Locked to the Shopify look | Restricted (Shopify apps) | ~2023 | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16.4+ (2023), based on :has(), container queries, and form-associated custom elements. The CDN includes a Popover polyfill. Shopify does not guarantee this minimum set. |

Browser years summarize minimum-version release dates. `~` marks a compatibility
estimate from shipped CSS and APIs, checked against
[MDN browser data](https://github.com/mdn/browser-compat-data).
Each value includes browser versions, the estimate’s basis, and the official
support policy. Astryx lists functional and full-fidelity tiers.

## The systems

Sizes measure full imports, minified with esbuild and compressed with gzip,
including separately compressed base CSS. Figures round up to 10 KiB and
exclude React and React DOM. Each card lists its measured package or source
snapshot and other exclusions.

These imports cover different component sets. Selective imports and copied
components usually ship less code. Measure your application before comparing
download costs.

### Anta

[Anta](https://anta.design). Framework-agnostic web components with optional React/Preact wrappers and no style runtime.

| Field | Value |
| --- | --- |
| Version | @antadesign/anta 0.3.26 |
| Delivery | Styled web components + JSX wrappers |
| Gzipped size | ~100 KiB |
| Measured version | @antadesign/anta 0.3.16 |
| Measurement scope | Wrappers, elements, CSS, tokens, and reset. Excludes React, the branded theme, and stickers. |
| Browser support | Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS. |

#### Strengths

- Runs in React, Preact, and plain HTML; JSX wrappers are optional.
- Plain CSS and cascade layers support overrides without a style runtime.
- Shared color, font, and focus tokens support light and dark themes.

#### Trade-offs

- No data grid or chart components in the published package.
- Requires modern browsers and provides no baseline polyfills.
- The API is still in 0.x and can change between minor releases.

#### Sources

- [Installation and browser support](./install-config.md#browser-support)
- [Theming](./theming.md)

### MUI (Material UI)

[MUI (Material UI)](https://mui.com/material-ui/). MUI’s React implementation of Google’s Material Design.

| Field | Value |
| --- | --- |
| Version | @mui/material 9.4.0 |
| Delivery | Styled React components |
| Gzipped size | ~170 KiB |
| Measured version | @mui/material 9.2.0 |
| Measurement scope | Material UI core and Emotion. Excludes React, icons, MUI X, and date adapters. |
| Browser support | Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later. |

#### Strengths

- Core controls plus MUI X data grids, charts, and date pickers.
- Themes provide component variants, slot overrides, and CSS variables.
- v9 adds NumberField and Menubar and expands keyboard navigation.

#### Trade-offs

- Emotion resolves styles at runtime; Pigment CSS remains on hold.
- Some MUI X features require Pro or Premium licenses.
- React-only. Custom designs can require component-level overrides.

#### Sources

- [v9 features](https://mui.com/blog/introducing-mui-v9/)
- [Browser requirements](https://mui.com/material-ui/migration/upgrade-to-v9/)
- [Project status](https://mui.com/blog/2026-and-beyond/)

### Mantine

[Mantine](https://mantine.dev). A React library with extensive hooks and official form, date, and chart packages.

| Field | Value |
| --- | --- |
| Version | @mantine/core 9.6.0 |
| Delivery | Styled React components |
| Gzipped size | ~210 KiB |
| Measured version | @mantine/core 9.4.2 |
| Measurement scope | Core components, hooks, and CSS. Excludes React and extension packages. |
| Browser support | Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later. |

#### Strengths

- Official packages cover forms, dates, charts, notifications, and rich text.
- CSS Modules and CSS variables avoid runtime CSS-in-JS.
- The Styles API exposes component selectors and CSS variables.

#### Trade-offs

- v9 requires React 19.2 or later; older React apps need an earlier Mantine major.
- Extensions add dependencies such as Recharts and Tiptap.

#### Sources

- [Packages and setup](https://mantine.dev/getting-started/)
- [v9 requirements](https://mantine.dev/changelog/9-0-0/)
- [Browser policy](https://mantine.dev/browser-support/)

### Astryx

[Astryx](https://astryx.atmeta.com). Meta's React design system on StyleX, with precompiled CSS and first-party AI-agent tooling.

| Field | Value |
| --- | --- |
| Version | @astryxdesign/core 0.5.3 |
| Delivery | Styled React components |
| Gzipped size | ~260 KiB |
| Measured version | @astryxdesign/core 0.1.8 |
| Measurement scope | Core components, StyleX runtime, and precompiled CSS. Excludes React. |
| Browser support | Two documented tiers: functional support at Baseline 2024 and full fidelity at Baseline 2026. Older functional-tier browsers need a positioning fallback for anchored overlays. |

#### Strengths

- Components, templates, and brand theming built on React and StyleX.
- Precompiled CSS needs no StyleX build step; source compilation is optional for tree-shaking.
- Agent tooling includes an MCP server, `llms.txt`, and a CLI for context files and source ejection.

#### Trade-offs

- Requires React 19 and a StyleX runtime peer dependency.
- Overlay positioning depends on CSS anchor positioning or an application-provided fallback.
- The public package is in 0.x; check migrations when updating.

#### Sources

- [Components and tooling](https://astryx.atmeta.com/blog/introducing-astryx)
- [Browser tiers](https://astryx.atmeta.com/docs/browser-support)

### Ant Design

[Ant Design](https://ant.design). An enterprise React library for data-dense admin and dashboard UIs.

| Field | Value |
| --- | --- |
| Version | antd 6.6.2 |
| Delivery | Styled React components |
| Gzipped size | ~470 KiB |
| Measured version | antd 6.5.2 |
| Measurement scope | All antd exports and its CSS-in-JS runtime. Excludes React and separately imported charts and icons. |
| Browser support | Estimated compatibility: Chrome / Edge 111+, Firefox 121+, and Safari 16.2+ (2023), based on :has(), color-mix(), and ResizeObserver in current components. Ant Design officially targets modern browsers; some enhancements can require newer versions. |

#### Strengths

- Table, Form, Transfer, and Cascader cover data-heavy application flows.
- Theme tokens provide dark and compact modes.
- v6 exposes semantic element styles and class names across components.

#### Trade-offs

- v6 requires React 18 or later and retains a CSS-in-JS runtime.
- Overrides that depend on internal DOM structure can need migration work.
- React-only; Vue and Angular versions are separate community projects.

#### Sources

- [v6 requirements](https://ant.design/docs/react/migration-v6/)
- [Component changes](https://ant.design/components/changelog/)
- [Checkbox focus styles](https://unpkg.com/antd@6.6.2/es/checkbox/style/index.js)

### Gravity UI

[Gravity UI](https://gravity-ui.com). A React design system with separate packages for controls, data tables, charts, and navigation.

| Field | Value |
| --- | --- |
| Version | @gravity-ui/uikit 7.49.0 |
| Delivery | Styled React components |
| Gzipped size | ~220 KiB |
| Measured version | @gravity-ui/uikit 7.47.1 |
| Measurement scope | UIKit components and CSS. Excludes React, icons, dates, charts, and the headless table package. |
| Browser support | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 15.4+ (2023), based on :has() in theme CSS, Array.at() in tabs and tables, and ResizeObserver. Extension packages can add requirements. |

#### Strengths

- A broad core plus packages for dates, icons, charts, navigation, and a headless data table.
- Built-in light, dark, and high-contrast themes, with CSS variables and a hosted theme editor.
- Supports React 16.14 through 19 in one release.

#### Trade-offs

- React-only.
- Dates, charts, and the data table add separate dependencies.

#### Sources

- [UIKit requirements and packages](https://gravity-ui.com/libraries/uikit)
- [Shipped theme CSS](https://unpkg.com/@gravity-ui/uikit@7.49.0/styles/styles.css)

### shadcn + Base UI + Tailwind

[shadcn](https://ui.shadcn.com) + [Base UI](https://base-ui.com) + [Tailwind](https://tailwindcss.com). Tailwind-styled source copied into your repo by CLI, using Base UI primitives by default.

| Field | Value |
| --- | --- |
| Version | Base UI registry |
| Delivery | Copy-paste React source on Base UI |
| Gzipped size | ~350 KiB |
| Measured version | shadcn/ui source @ 705ce59 |
| Measurement scope | 61 Base UI registry components and generated Tailwind CSS. Excludes React and Lucide. |
| Browser support | Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. |

#### Strengths

- Copied source can be edited directly in your repository.
- Base UI is the default; Radix and React Aria are also supported.
- The CLI installs components, styles, and their dependencies.

#### Trade-offs

- Tailwind is required; generated components use utility classes throughout.
- Upstream fixes require manual diffs, especially after local edits.
- You own consistency across copied files, and registry quality varies.

#### Sources

- [Default Base UI registry](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [React Aria option](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)
- [Tailwind browser requirements](https://tailwindcss.com/docs/compatibility)

### Untitled UI + React Aria + Tailwind

[Untitled UI](https://www.untitledui.com/react) + [React Aria](https://react-spectrum.adobe.com/react-aria/) + [Tailwind](https://tailwindcss.com). React and Tailwind component source built on React Aria, with a companion Figma kit.

| Field | Value |
| --- | --- |
| Version | React app source |
| Delivery | Copy-paste React source |
| Gzipped size | ~410 KiB |
| Measured version | Untitled UI source @ eaee6a5 |
| Measurement scope | 102 base and application source files, React Aria, and generated Tailwind CSS. Excludes React, Next.js, and icons. |
| Browser support | Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements. |

#### Strengths

- Component source can be edited directly in your repository.
- React Aria provides the underlying interaction primitives.
- Includes application and marketing components with a companion Figma kit.

#### Trade-offs

- Uses React 19.2, Tailwind CSS 4, and React Aria runtime dependencies.
- Additional components, page examples, and design assets have paid tiers.
- You own consistency and upgrades across copied files.

#### Sources

- [Stack and licensing](https://www.untitledui.com/react/docs/introduction)
- [Tailwind browser requirements](https://tailwindcss.com/docs/compatibility)

### Blueprint

[Blueprint](https://blueprintjs.com). Palantir's React toolkit for complex, data-dense desktop interfaces.

| Field | Value |
| --- | --- |
| Version | @blueprintjs/core 6.18.0 |
| Delivery | Styled React components |
| Gzipped size | ~350 KiB |
| Measured version | @blueprintjs/core 6.17.2 |
| Measurement scope | Core components and compiled CSS. Excludes React and the Table, Select, and Datetime packages. |
| Browser support | Estimated compatibility: Chrome / Edge 111+, Firefox 113+, and Safari 16.2+ (2023), based on color-mix() in core CSS. Relative-color enhancements have fallbacks. The repository maintains a rolling Browserslist target. |

#### Strengths

- Built for dense desktop tools: a virtualized Table, Omnibar, and dual-calendar date picker.
- Core CSS ships precompiled and can be customized with Sass.
- FocusStyleManager switches focus indicators by input method.

#### Trade-offs

- Designed for desktop applications; test touch-heavy flows separately.
- Table, Select, and Datetime are separate packages.
- React-only.

#### Sources

- [Toolkit and packages](https://github.com/palantir/blueprint)
- [Browser targets](https://github.com/palantir/blueprint/blob/develop/.browserslistrc)
- [Shipped CSS and fallbacks](https://unpkg.com/@blueprintjs/core@6.18.0/lib/css/blueprint.css)

### Carbon

[Carbon](https://carbondesignsystem.com). IBM's enterprise design system for React and first-party web components.

| Field | Value |
| --- | --- |
| Version | @carbon/react 1.115.0 |
| Delivery | Styled React (+ web components) |
| Gzipped size | ~300 KiB |
| Measured version | @carbon/react 1.112.0 |
| Measurement scope | React components and compiled Carbon CSS. Excludes React, separately imported icons, charts, and web components. |
| Browser support | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16+ (2023), based on :has() and container queries in the shipped CSS. Official support covers the latest stable browser releases. |

#### Strengths

- Publishes component accessibility results, including manual screen-reader checks mapped to WCAG.
- First-party React and web-component implementations.
- Theme-scoped role tokens support four built-in themes.

#### Trade-offs

- The documented React setup requires a Sass build step.
- Typography and component customization can require Sass or CSS overrides.
- Angular, Vue, and Svelte implementations are community-maintained.

#### Sources

- [React setup](https://carbondesignsystem.com/developing/frameworks/react/)
- [Frameworks and browser policy](https://carbondesignsystem.com/help/faq/)
- [Themes](https://carbondesignsystem.com/elements/themes/overview/)
- [Shipped CSS](https://unpkg.com/@carbon/styles@1.114.0/css/styles.css)

### Atlassian (Atlaskit)

[Atlassian (Atlaskit)](https://atlassian.design). Atlassian’s React design system, distributed as independently versioned packages.

| Field | Value |
| --- | --- |
| Version | @atlaskit/tokens 16.11.2 |
| Delivery | Styled React components |
| Gzipped size | ~600 KiB |
| Measured version | 57-package snapshot, July 2026 |
| Measurement scope | 57 Design System packages. Excludes React, tables, icons, editors, and product packages. |
| Browser support | Estimated compatibility for compiled controls: Chrome / Edge 86+, Firefox 85+, and Safari 15.4+ (2022), based on CSS variables and :focus-visible. Other packages can require newer features. Official support follows the target Atlassian product. |

#### Strengths

- Design tokens and components used in Atlassian products.
- Compiled styles ship as CSS alongside the packages.
- Separate utilities include Pragmatic drag and drop and Focus ring.

#### Trade-offs

- Independently versioned packages require dependency coordination.
- The recommended build setup adds Babel and Compiled configuration.
- ADS terms cover Atlassian integrations; individual open-source packages may grant broader rights.

#### Sources

- [Build setup](https://atlassian.design/get-started/develop/atlassians/)
- [Design system license](https://atlassian.design/license/)
- [Button focus styles](https://unpkg.com/@atlaskit/button@25.3.2/dist/esm/new-button/variants/shared/button-base.compiled.css)

### Web Awesome

[Web Awesome](https://webawesome.com). Font Awesome's framework-agnostic web components and CSS framework, succeeding Shoelace.

| Field | Value |
| --- | --- |
| Version | @awesome.me/webawesome 3.12.0 |
| Delivery | Styled web components |
| Gzipped size | ~190 KiB |
| Measured version | @awesome.me/webawesome 3.10.0 |
| Measurement scope | Free components, Lit, and base CSS. Excludes Pro components and web fonts. |
| Browser support | Estimated compatibility: Chrome / Edge 125+, Firefox 128+, and Safari 18+ (2024). Current styles use custom states and relative OKLCH colors. Official support covers the latest two major browser versions. |

#### Strengths

- Works in any stack or plain HTML without a build step.
- Includes form controls, layout utilities, observers, and Toasts.
- CSS variables and shadow parts support theming.

#### Trade-offs

- Combobox, date and file inputs, Data Grid, charts, and video require Pro.
- Lit is a runtime dependency alongside React or Vue.
- Its own docs describe SSR support as experimental.

#### Sources

- [Components and Pro features](https://webawesome.com/docs/components)
- [Server rendering](https://webawesome.com/docs/ssr)
- [Browser policy](https://webawesome.com/docs/resources/browser-support)
- [Shipped theme CSS](https://unpkg.com/@awesome.me/webawesome@3.12.0/dist/styles/themes/default.css)

### Shopify Polaris

[Shopify Polaris](https://shopify.dev/docs/api/app-home/web-components). Shopify's web-component system for apps that must match Shopify Admin.

| Field | Value |
| --- | --- |
| Version | Polaris CDN 1.x; 1.1 RC |
| Delivery | Styled web components (CDN) |
| Gzipped size | ~120 KiB |
| Measured version | polaris.js, July 31, 2026 |
| Measurement scope | CDN script with embedded component CSS. Excludes separately loaded fonts and icons. |
| Browser support | Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16.4+ (2023), based on :has(), container queries, and form-associated custom elements. The CDN includes a Popover polyfill. Shopify does not guarantee this minimum set. |

#### Strengths

- Web components match Shopify Admin across frameworks.
- Box exposes layout, spacing, border, and color properties.
- CDN versioning now separates compatible updates from major upgrades.

#### Trade-offs

- Styled for Shopify apps, with customization limited to the exposed properties.
- The 1.1 release candidate changes in place until it becomes stable.
- Use is subject to Shopify’s app-specific license terms.

#### Sources

- [CDN versioning](https://community.shopify.dev/t/the-polaris-cdn-is-adopting-semantic-versioning/37332)
- [1.1 release candidate](https://shopify.dev/changelog/polaris-cdn-1-1-release-candidate)
- [Box properties](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box)
- [CDN implementation](https://cdn.shopify.com/shopifycloud/polaris-1.js)

## Component coverage

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
| Notification: Toast, banner, inline alert | [Included](./components/toaster.md) | [Included](https://mui.com/material-ui/react-snackbar/) | [Included](https://mantine.dev/x/notifications/) | [Included](https://astryx.atmeta.com/components/Toast) | [Included](https://ant.design/components/message) | [Included](https://gravity-ui.com/components/uikit/toaster) | [Included](https://ui.shadcn.com/docs/components/sonner) | [Paid tier](https://www.untitledui.com/react/components/notifications) | [Included](https://blueprintjs.com/docs/#core/components/toast) | [Included](https://carbondesignsystem.com/components/notification/usage/) | [Included](https://atlassian.design/components/flag/examples) | [Included](https://webawesome.com/docs/components/toast/) | [Basic or community-only](https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/banner) |
| Expander: Disclosure / Accordion | [Included](./components/expander.md) | [Included](https://mui.com/material-ui/react-accordion/) | [Included](https://mantine.dev/core/accordion/) | [Included](https://astryx.atmeta.com/components/Collapsible) | [Included](https://ant.design/components/collapse) | [Included](https://gravity-ui.com/components/uikit/disclosure) | [Included](https://ui.shadcn.com/docs/components/accordion) | [Paid tier](https://www.untitledui.com/react/marketing/faq-sections/faq-accordion-04-brand) | [Included](https://blueprintjs.com/docs/#core/components/collapse) | [Included](https://carbondesignsystem.com/components/accordion/usage/) | Not shipped | [Included](https://webawesome.com/docs/components/accordion/) | Not shipped |
| Table: Table / data grid | [Basic or community-only](./packages/table.md) | [Included](https://mui.com/material-ui/react-table/) | [Basic or community-only](https://mantine.dev/core/table/) | [Included](https://astryx.atmeta.com/components/Table) | [Included](https://ant.design/components/table) | [Included](https://gravity-ui.com/components/uikit/table) | [Included](https://ui.shadcn.com/docs/components/table) | [Included](https://www.untitledui.com/react/components/tables) | [Included](https://blueprintjs.com/docs/#table) | [Included](https://carbondesignsystem.com/components/data-table/usage/) | [Included](https://atlassian.design/components/dynamic-table/examples) | [Paid tier](https://webawesome.com/docs/components/data-grid/) | [Included](https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/table) |
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

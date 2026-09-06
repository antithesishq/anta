/**
 * Shared comparison facts. Current package versions and descriptions use
 * AS_OF; bundleVersion preserves the separately dated size measurement.
 * Coverage groups components by job and links to their public APIs.
 */

export const AS_OF = 'September 6, 2026'
export const SIZE_AS_OF = 'July 2026'

/** Anta component routes used by both coverage references. */
export const ANTA_SLUG: Record<string, string> = {
  button: 'button', textinput: 'input', select: 'select', combobox: 'input-autocomplete',
  choice: 'checkbox', slider: 'slider',
  datetime: 'input-date', tabs: 'tabs', menu: 'menu', tooltip: 'tooltip',
  dialog: 'dialog', toast: 'toaster', accordion: 'expander', table: 'table', tag: 'tag', avatar: 'avatar', card: 'card', progress: 'progress', steps: 'steps', nav: 'breadcrumbs',
  icons: 'icon', typography: 'text', utilities: 'box',
}

export type Mark = 'yes' | 'partial' | 'no' | 'paid'

export interface SystemNamePart {
  label: string
  href: string
}

export interface System {
  /** Short key, also the coverage-column id. */
  id: string
  name: string
  /** Linked names that replace `name` where a combined system is rendered. */
  nameParts?: SystemNamePart[]
  /** Compact label for the matrix column headers, where horizontal space is
   *  tight. Falls back to `name`. */
  short?: string
  /** True for Anta; drives the highlight styling in both matrices. */
  anta?: boolean
  /** Package + version string, e.g. "@mui/material 9.2.0". */
  version: string
  /** Canonical docs URL. */
  docs: string
  /** One-line identity. */
  tagline: string
  /** Distribution / shape, e.g. "Styled web components + JSX wrappers". */
  kind: string
  /** Primary framework(s) it targets, shown on the first line. */
  frameworks: string
  /** Secondary / community reach, shown muted in parens on a second line. */
  frameworksNote?: string
  /** Styling mechanism. */
  styling: string
  /** License, short. */
  license: string
  /** Measured minified, gzip-compressed download for a full useful import.
   *  This is context, not a component-level benchmark. */
  bundleSize: string
  /** Package version or source snapshot used for the size measurement. */
  bundleVersion: string
  /** What the size includes and excludes. */
  bundleIncludes: string
  /** Browser policy for this version. */
  browsers: string
  /** Release year of the minimum browser set. Prefix feature-based estimates with ~. */
  browserSupport: string
  /** Official references for the card's claims and browser policy. */
  sources: SystemNamePart[]
  pros: string[]
  cons: string[]
}

/** Anta first (highlighted), then the framework-agnostic web-component peers,
 *  the batteries-included React libraries, the headless React primitives, and
 *  the copy-paste model, roughly grouped by how close they sit to Anta. */
export const SYSTEMS: System[] = [
  {
    id: 'anta',
    name: 'Anta',
    anta: true,
    version: '@antadesign/anta 0.3.26',
    docs: 'https://anta.design',
    tagline: 'Framework-agnostic web components with optional React/Preact wrappers and no style runtime.',
    kind: 'Styled web components + JSX wrappers',
    frameworks: 'Web components',
    frameworksNote: 'React and Preact wrappers',
    styling: 'Plain CSS + CSS-variable tokens',
    license: 'MIT',
    bundleSize: '~100 KiB',
    bundleVersion: '@antadesign/anta 0.3.16',
    bundleIncludes: 'Wrappers, elements, CSS, tokens, and reset. Excludes React, the branded theme, and stickers.',
    browsers: "Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS.",
    browserSupport: '2024',
    sources: [
      { label: 'Installation and browser support', href: '/install/#browser-support' },
      { label: 'Theming', href: '/theming/' },
    ],
    pros: [
      'Runs in React, Preact, and plain HTML; JSX wrappers are optional.',
      'Plain CSS and cascade layers support overrides without a style runtime.',
      'Shared color, font, and focus tokens support light and dark themes.',
    ],
    cons: [
      'No data grid or chart components in the published package.',
      'Requires modern browsers and provides no baseline polyfills.',
      'The API is still in 0.x and can change between minor releases.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    short: 'WA',
    version: '@awesome.me/webawesome 3.12.0',
    docs: 'https://webawesome.com',
    tagline: "Font Awesome's framework-agnostic web components and CSS framework, succeeding Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Web components',
    frameworksNote: 'React, Vue, Angular, Svelte guides',
    styling: 'CSS framework + CSS variables',
    license: 'MIT core + paid Pro tier',
    bundleSize: '~190 KiB',
    bundleVersion: '@awesome.me/webawesome 3.10.0',
    bundleIncludes: 'Free components, Lit, and base CSS. Excludes Pro components and web fonts.',
    browsers: 'Estimated compatibility: Chrome / Edge 125+, Firefox 128+, and Safari 18+ (2024). Current styles use custom states and relative OKLCH colors. Official support covers the latest two major browser versions.',
    browserSupport: '~2024',
    sources: [
      { label: 'Components and Pro features', href: 'https://webawesome.com/docs/components' },
      { label: 'Server rendering', href: 'https://webawesome.com/docs/ssr' },
      { label: 'Browser policy', href: 'https://webawesome.com/docs/resources/browser-support' },
      { label: 'Shipped theme CSS', href: 'https://unpkg.com/@awesome.me/webawesome@3.12.0/dist/styles/themes/default.css' },
    ],
    pros: [
      'Works in any stack or plain HTML without a build step.',
      'Includes form controls, layout utilities, observers, and Toasts.',
      'CSS variables and shadow parts support theming.',
    ],
    cons: [
      'Combobox, date and file inputs, Data Grid, charts, and video require Pro.',
      'Lit is a runtime dependency alongside React or Vue.',
      'Its own docs describe SSR support as experimental.',
    ],
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    short: 'Polaris',
    version: 'Polaris CDN 1.x; 1.1 RC',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline: "Shopify's web-component system for apps that must match Shopify Admin.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Web components',
    styling: 'Locked to the Shopify look',
    license: 'Restricted (Shopify apps)',
    bundleSize: '~120 KiB',
    bundleVersion: 'polaris.js, July 31, 2026',
    bundleIncludes: 'CDN script with embedded component CSS. Excludes separately loaded fonts and icons.',
    browsers: 'Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16.4+ (2023), based on :has(), container queries, and form-associated custom elements. The CDN includes a Popover polyfill. Shopify does not guarantee this minimum set.',
    browserSupport: '~2023',
    sources: [
      { label: 'CDN versioning', href: 'https://community.shopify.dev/t/the-polaris-cdn-is-adopting-semantic-versioning/37332' },
      { label: '1.1 release candidate', href: 'https://shopify.dev/changelog/polaris-cdn-1-1-release-candidate' },
      { label: 'Box properties', href: 'https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box' },
      { label: 'CDN implementation', href: 'https://cdn.shopify.com/shopifycloud/polaris-1.js' },
    ],
    pros: [
      'Web components match Shopify Admin across frameworks.',
      'Box exposes layout, spacing, border, and color properties.',
      'CDN versioning now separates compatible updates from major upgrades.',
    ],
    cons: [
      'Styled for Shopify apps, with customization limited to the exposed properties.',
      'The 1.1 release candidate changes in place until it becomes stable.',
      'Use is subject to Shopify’s app-specific license terms.',
    ],
  },
  {
    id: 'mui',
    name: 'MUI (Material UI)',
    short: 'MUI',
    version: '@mui/material 9.4.0',
    docs: 'https://mui.com/material-ui/',
    tagline: 'MUI’s React implementation of Google’s Material Design.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS-in-JS (Emotion)',
    license: 'MIT core + paid MUI X',
    bundleSize: '~170 KiB',
    bundleVersion: '@mui/material 9.2.0',
    bundleIncludes: 'Material UI core and Emotion. Excludes React, icons, MUI X, and date adapters.',
    browsers: 'Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later.',
    browserSupport: '2024',
    sources: [
      { label: 'v9 features', href: 'https://mui.com/blog/introducing-mui-v9/' },
      { label: 'Browser requirements', href: 'https://mui.com/material-ui/migration/upgrade-to-v9/' },
      { label: 'Project status', href: 'https://mui.com/blog/2026-and-beyond/' },
    ],
    pros: [
      'Core controls plus MUI X data grids, charts, and date pickers.',
      'Themes provide component variants, slot overrides, and CSS variables.',
      'v9 adds NumberField and Menubar and expands keyboard navigation.',
    ],
    cons: [
      'Emotion resolves styles at runtime; Pigment CSS remains on hold.',
      'Some MUI X features require Pro or Premium licenses.',
      'React-only. Custom designs can require component-level overrides.',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    short: 'Ant',
    version: 'antd 6.6.2',
    docs: 'https://ant.design',
    tagline: 'An enterprise React library for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React',
    frameworksNote: 'Angular, Vue community ports',
    styling: 'CSS-in-JS + CSS variables (v6)',
    license: 'MIT',
    bundleSize: '~470 KiB',
    bundleVersion: 'antd 6.5.2',
    bundleIncludes: 'All antd exports and its CSS-in-JS runtime. Excludes React and separately imported charts and icons.',
    browsers: 'Estimated compatibility: Chrome / Edge 111+, Firefox 121+, and Safari 16.2+ (2023), based on :has(), color-mix(), and ResizeObserver in current components. Ant Design officially targets modern browsers; some enhancements can require newer versions.',
    browserSupport: '~2023',
    sources: [
      { label: 'v6 requirements', href: 'https://ant.design/docs/react/migration-v6/' },
      { label: 'Component changes', href: 'https://ant.design/components/changelog/' },
      { label: 'Checkbox focus styles', href: 'https://unpkg.com/antd@6.6.2/es/checkbox/style/index.js' },
    ],
    pros: [
      'Table, Form, Transfer, and Cascader cover data-heavy application flows.',
      'Theme tokens provide dark and compact modes.',
      'v6 exposes semantic element styles and class names across components.',
    ],
    cons: [
      'v6 requires React 18 or later and retains a CSS-in-JS runtime.',
      'Overrides that depend on internal DOM structure can need migration work.',
      'React-only; Vue and Angular versions are separate community projects.',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    version: '@mantine/core 9.6.0',
    docs: 'https://mantine.dev',
    tagline: 'A React library with extensive hooks and official form, date, and chart packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS Modules + CSS variables',
    license: 'MIT',
    bundleSize: '~210 KiB',
    bundleVersion: '@mantine/core 9.4.2',
    bundleIncludes: 'Core components, hooks, and CSS. Excludes React and extension packages.',
    browsers: 'Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later.',
    browserSupport: '2022',
    sources: [
      { label: 'Packages and setup', href: 'https://mantine.dev/getting-started/' },
      { label: 'v9 requirements', href: 'https://mantine.dev/changelog/9-0-0/' },
      { label: 'Browser policy', href: 'https://mantine.dev/browser-support/' },
    ],
    pros: [
      'Official packages cover forms, dates, charts, notifications, and rich text.',
      'CSS Modules and CSS variables avoid runtime CSS-in-JS.',
      'The Styles API exposes component selectors and CSS variables.',
    ],
    cons: [
      'v9 requires React 19.2 or later; older React apps need an earlier Mantine major.',
      'Extensions add dependencies such as Recharts and Tiptap.',
    ],
  },
  {
    id: 'carbon',
    name: 'Carbon',
    version: '@carbon/react 1.115.0',
    docs: 'https://carbondesignsystem.com',
    tagline: "IBM's enterprise design system for React and first-party web components.",
    kind: 'Styled React (+ web components)',
    frameworks: 'React + Lit web components',
    frameworksNote: 'Angular, Vue, Svelte community',
    styling: 'Sass + CSS variables',
    license: 'Apache-2.0',
    bundleSize: '~300 KiB',
    bundleVersion: '@carbon/react 1.112.0',
    bundleIncludes: 'React components and compiled Carbon CSS. Excludes React, separately imported icons, charts, and web components.',
    browsers: 'Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 16+ (2023), based on :has() and container queries in the shipped CSS. Official support covers the latest stable browser releases.',
    browserSupport: '~2023',
    sources: [
      { label: 'React setup', href: 'https://carbondesignsystem.com/developing/frameworks/react/' },
      { label: 'Frameworks and browser policy', href: 'https://carbondesignsystem.com/help/faq/' },
      { label: 'Themes', href: 'https://carbondesignsystem.com/elements/themes/overview/' },
      { label: 'Shipped CSS', href: 'https://unpkg.com/@carbon/styles@1.114.0/css/styles.css' },
    ],
    pros: [
      'Publishes component accessibility results, including manual screen-reader checks mapped to WCAG.',
      'First-party React and web-component implementations.',
      'Theme-scoped role tokens support four built-in themes.',
    ],
    cons: [
      'The documented React setup requires a Sass build step.',
      'Typography and component customization can require Sass or CSS overrides.',
      'Angular, Vue, and Svelte implementations are community-maintained.',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Atlaskit)',
    short: 'Atlaskit',
    version: '@atlaskit/tokens 16.11.2',
    docs: 'https://atlassian.design',
    tagline: 'Atlassian’s React design system, distributed as independently versioned packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    license: 'Package-specific OSS + ADS terms',
    bundleSize: '~600 KiB',
    bundleVersion: '57-package snapshot, July 2026',
    bundleIncludes: '57 Design System packages. Excludes React, tables, icons, editors, and product packages.',
    browsers: 'Estimated compatibility for compiled controls: Chrome / Edge 86+, Firefox 85+, and Safari 15.4+ (2022), based on CSS variables and :focus-visible. Other packages can require newer features. Official support follows the target Atlassian product.',
    browserSupport: '~2022',
    sources: [
      { label: 'Build setup', href: 'https://atlassian.design/get-started/develop/atlassians/' },
      { label: 'Design system license', href: 'https://atlassian.design/license/' },
      { label: 'Button focus styles', href: 'https://unpkg.com/@atlaskit/button@25.3.2/dist/esm/new-button/variants/shared/button-base.compiled.css' },
    ],
    pros: [
      'Design tokens and components used in Atlassian products.',
      'Compiled styles ship as CSS alongside the packages.',
      'Separate utilities include Pragmatic drag and drop and Focus ring.',
    ],
    cons: [
      'Independently versioned packages require dependency coordination.',
      'The recommended build setup adds Babel and Compiled configuration.',
      'ADS terms cover Atlassian integrations; individual open-source packages may grant broader rights.',
    ],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    version: '@blueprintjs/core 6.18.0',
    docs: 'https://blueprintjs.com',
    tagline: "Palantir's React toolkit for complex, data-dense desktop interfaces.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass-compiled CSS (bp6- classes)',
    license: 'Apache-2.0',
    bundleSize: '~350 KiB',
    bundleVersion: '@blueprintjs/core 6.17.2',
    bundleIncludes: 'Core components and compiled CSS. Excludes React and the Table, Select, and Datetime packages.',
    browsers: 'Estimated compatibility: Chrome / Edge 111+, Firefox 113+, and Safari 16.2+ (2023), based on color-mix() in core CSS. Relative-color enhancements have fallbacks. The repository maintains a rolling Browserslist target.',
    browserSupport: '~2023',
    sources: [
      { label: 'Toolkit and packages', href: 'https://github.com/palantir/blueprint' },
      { label: 'Browser targets', href: 'https://github.com/palantir/blueprint/blob/develop/.browserslistrc' },
      { label: 'Shipped CSS and fallbacks', href: 'https://unpkg.com/@blueprintjs/core@6.18.0/lib/css/blueprint.css' },
    ],
    pros: [
      'Built for dense desktop tools: a virtualized Table, Omnibar, and dual-calendar date picker.',
      'Core CSS ships precompiled and can be customized with Sass.',
      'FocusStyleManager switches focus indicators by input method.',
    ],
    cons: [
      'Designed for desktop applications; test touch-heavy flows separately.',
      'Table, Select, and Datetime are separate packages.',
      'React-only.',
    ],
  },
  {
    id: 'astryx',
    name: 'Astryx',
    version: '@astryxdesign/core 0.5.3',
    docs: 'https://astryx.atmeta.com',
    tagline: "Meta's React design system on StyleX, with precompiled CSS and first-party AI-agent tooling.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'StyleX (precompiled atomic CSS)',
    license: 'MIT',
    bundleSize: '~260 KiB',
    bundleVersion: '@astryxdesign/core 0.1.8',
    bundleIncludes: 'Core components, StyleX runtime, and precompiled CSS. Excludes React.',
    browsers: 'Two documented tiers: functional support at Baseline 2024 and full fidelity at Baseline 2026. Older functional-tier browsers need a positioning fallback for anchored overlays.',
    browserSupport: '2024 / 2026',
    sources: [
      { label: 'Components and tooling', href: 'https://astryx.atmeta.com/blog/introducing-astryx' },
      { label: 'Browser tiers', href: 'https://astryx.atmeta.com/docs/browser-support' },
    ],
    pros: [
      'Components, templates, and brand theming built on React and StyleX.',
      'Precompiled CSS needs no StyleX build step; source compilation is optional for tree-shaking.',
      'Agent tooling includes an MCP server, `llms.txt`, and a CLI for context files and source ejection.',
    ],
    cons: [
      'Requires React 19 and a StyleX runtime peer dependency.',
      'Overlay positioning depends on CSS anchor positioning or an application-provided fallback.',
      'The public package is in 0.x; check migrations when updating.',
    ],
  },
  {
    id: 'gravity',
    name: 'Gravity UI',
    short: 'Gravity',
    version: '@gravity-ui/uikit 7.49.0',
    docs: 'https://gravity-ui.com',
    tagline: 'A React design system with separate packages for controls, data tables, charts, and navigation.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS (BEM classes) + CSS variables',
    license: 'MIT',
    bundleSize: '~220 KiB',
    bundleVersion: '@gravity-ui/uikit 7.47.1',
    bundleIncludes: 'UIKit components and CSS. Excludes React, icons, dates, charts, and the headless table package.',
    browsers: 'Estimated compatibility: Chrome / Edge 105+, Firefox 121+, and Safari 15.4+ (2023), based on :has() in theme CSS, Array.at() in tabs and tables, and ResizeObserver. Extension packages can add requirements.',
    browserSupport: '~2023',
    sources: [
      { label: 'UIKit requirements and packages', href: 'https://gravity-ui.com/libraries/uikit' },
      { label: 'Shipped theme CSS', href: 'https://unpkg.com/@gravity-ui/uikit@7.49.0/styles/styles.css' },
    ],
    pros: [
      'A broad core plus packages for dates, icons, charts, navigation, and a headless data table.',
      'Built-in light, dark, and high-contrast themes, with CSS variables and a hosted theme editor.',
      'Supports React 16.14 through 19 in one release.',
    ],
    cons: [
      'React-only.',
      'Dates, charts, and the data table add separate dependencies.',
    ],
  },
  {
    id: 'shadcn',
    name: 'shadcn + Base UI + Tailwind',
    nameParts: [
      { label: 'shadcn', href: 'https://ui.shadcn.com' },
      { label: 'Base UI', href: 'https://base-ui.com' },
      { label: 'Tailwind', href: 'https://tailwindcss.com' },
    ],
    short: 'shadcn',
    version: 'Base UI registry',
    docs: 'https://ui.shadcn.com',
    tagline: 'Tailwind-styled source copied into your repo by CLI, using Base UI primitives by default.',
    kind: 'Copy-paste React source on Base UI',
    frameworks: 'React',
    frameworksNote: 'Vue, Svelte community ports',
    styling: 'Tailwind + CSS variables',
    license: 'MIT',
    bundleSize: '~350 KiB',
    bundleVersion: 'shadcn/ui source @ 705ce59',
    bundleIncludes: '61 Base UI registry components and generated Tailwind CSS. Excludes React and Lucide.',
    browsers: "Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later.",
    browserSupport: '2024',
    sources: [
      { label: 'Default Base UI registry', href: 'https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default' },
      { label: 'React Aria option', href: 'https://ui.shadcn.com/docs/changelog/2026-07-react-aria' },
      { label: 'Tailwind browser requirements', href: 'https://tailwindcss.com/docs/compatibility' },
    ],
    pros: [
      'Copied source can be edited directly in your repository.',
      'Base UI is the default; Radix and React Aria are also supported.',
      'The CLI installs components, styles, and their dependencies.',
    ],
    cons: [
      'Tailwind is required; generated components use utility classes throughout.',
      'Upstream fixes require manual diffs, especially after local edits.',
      'You own consistency across copied files, and registry quality varies.',
    ],
  },
  {
    id: 'untitledui',
    name: 'Untitled UI + React Aria + Tailwind',
    nameParts: [
      { label: 'Untitled UI', href: 'https://www.untitledui.com/react' },
      { label: 'React Aria', href: 'https://react-spectrum.adobe.com/react-aria/' },
      { label: 'Tailwind', href: 'https://tailwindcss.com' },
    ],
    short: 'Untitled',
    version: 'React app source',
    docs: 'https://www.untitledui.com/react',
    tagline: 'React and Tailwind component source built on React Aria, with a companion Figma kit.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    styling: 'Tailwind CSS + React Aria',
    license: 'MIT core + paid Pro tier',
    bundleSize: '~410 KiB',
    bundleVersion: 'Untitled UI source @ eaee6a5',
    bundleIncludes: '102 base and application source files, React Aria, and generated Tailwind CSS. Excludes React, Next.js, and icons.',
    browsers: "Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements.",
    browserSupport: '2024',
    sources: [
      { label: 'Stack and licensing', href: 'https://www.untitledui.com/react/docs/introduction' },
      { label: 'Tailwind browser requirements', href: 'https://tailwindcss.com/docs/compatibility' },
    ],
    pros: [
      'Component source can be edited directly in your repository.',
      'React Aria provides the underlying interaction primitives.',
      'Includes application and marketing components with a companion Figma kit.',
    ],
    cons: [
      'Uses React 19.2, Tailwind CSS 4, and React Aria runtime dependencies.',
      'Additional components, page examples, and design assets have paid tiers.',
      'You own consistency and upgrades across copied files.',
    ],
  },
]

/** Component-coverage categories. Grouped by job, so a Dialog / Modal / Drawer
 *  family is one row. Order roughly follows a typical app's control set. */
export interface Category {
  id: string
  label: string
  /** The grouped members, shown as the row's sub-label. */
  members: string
  /** Representative components by system, shown in the cell tooltip. */
  examples?: Record<string, string>
}

export const CATEGORIES: Category[] = [
  { id: 'button', label: 'Button', members: 'Button, icon button, group' },
  { id: 'textinput', label: 'Text input', members: 'Text, number, password, textarea' },
  { id: 'select', label: 'Select', members: 'Single/multi dropdown select' },
  { id: 'combobox', label: 'Combobox', members: 'Autocomplete, searchable select' },
  { id: 'choice', label: 'Checkbox / Radio / Switch', members: 'Toggles and choice groups' },
  { id: 'slider', label: 'Slider', members: 'Range / value slider' },
  { id: 'datetime', label: 'Date & time', members: 'Calendar, date/time picker' },
  { id: 'tabs', label: 'Tabs', members: 'Tab strip + panels' },
  { id: 'menu', label: 'Menu', members: 'Dropdown, context, menubar' },
  { id: 'tooltip', label: 'Tooltip / Popover', members: 'Hover + click surfaces' },
  { id: 'dialog', label: 'Dialog', members: 'Modal, drawer, sheet' },
  { id: 'toast', label: 'Notification', members: 'Toast, banner, inline alert' },
  { id: 'accordion', label: 'Expander', members: 'Disclosure / Accordion' },
  { id: 'table', label: 'Table', members: 'Table / data grid' },
  { id: 'tag', label: 'Tag / Badge', members: 'Tag, badge, chip, lozenge' },
  { id: 'progress', label: 'Progress', members: 'Bar, spinner, skeleton' },
  { id: 'avatar', label: 'Avatar', members: 'Avatar / avatar group' },
  { id: 'card', label: 'Card', members: 'Card / tile / surface' },
  { id: 'steps', label: 'Steps', members: 'Stepper, wizard, progress tracker' },
  { id: 'nav', label: 'Breadcrumbs', members: 'Breadcrumb navigation' },
  { id: 'icons', label: 'Icons', members: 'Bundled icon set' },
  { id: 'typography', label: 'Typography', members: 'Text / title components' },
  { id: 'charts', label: 'Charts', members: 'First-party data viz' },
  // Utility and focus coverage verified against public APIs on September 5, 2026.
  {
    id: 'utilities', label: 'Utility containers', members: 'Boxes with observers, scroll, and input',
    examples: {
      anta: 'Box, Capture', webawesome: 'Resize Observer', mui: 'ClickAwayListener',
      mantine: 'useResizeObserver', atlassian: 'Pragmatic drag and drop',
      blueprint: 'ResizeSensor', astryx: 'useScrollOverflow', shadcn: 'Scroll Area',
      untitledui: 'React Aria useMove', gravity: 'useResizeObserver',
      polaris: 'Box (responsive styling and accessibility)',
    },
  },
  {
    id: 'focus', label: 'Focus management', members: 'Focus detection and traps',
    examples: {
      mui: 'Unstable_TrapFocus (experimental)', mantine: 'FocusTrap, useFocusTrap',
      astryx: 'useFocusTrap, useListFocus', untitledui: 'React Aria FocusScope, useFocusManager',
      blueprint: 'FocusStyleManager (focus indicators)',
    },
  },
]

/**
 * Coverage marks per system, keyed by category id. Absent keys default to
 * 'no'. Honest, grouped-by-job marks; see the module header. `partial` =
 * basic, simple, or community-only; `paid` = behind a commercial tier.
 * A mark means the combined system ships the component readers use; an absent
 * mark means it does not.
 */
export const COVERAGE: Record<string, Partial<Record<string, Mark>>> = {
  anta: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes', choice: 'yes', slider: 'yes',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes', dialog: 'yes', toast: 'yes',
    accordion: 'yes', table: 'partial', tag: 'yes', avatar: 'yes', card: 'yes', progress: 'yes', steps: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', utilities: 'yes',
  },
  webawesome: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'paid',
    choice: 'yes', slider: 'yes', datetime: 'paid', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes', table: 'paid',
    tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes', nav: 'yes',
    icons: 'yes', typography: 'partial', charts: 'paid', utilities: 'yes',
  },
  polaris: {
    button: 'yes', textinput: 'yes', select: 'yes', choice: 'yes',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes',
    dialog: 'partial', toast: 'partial', table: 'yes', tag: 'yes',
    progress: 'partial', avatar: 'yes', card: 'yes', icons: 'yes',
    typography: 'yes', utilities: 'yes',
  },
  mui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes', utilities: 'yes', focus: 'yes',
  },
  antd: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes', utilities: 'no',
  },
  mantine: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'partial', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'partial', typography: 'yes', charts: 'yes', utilities: 'yes', focus: 'yes',
  },
  carbon: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'partial', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'partial', charts: 'yes', utilities: 'no',
  },
  atlassian: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', table: 'yes', tag: 'yes',
    progress: 'yes', avatar: 'yes', card: 'partial',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'partial', utilities: 'yes',
  },
  blueprint: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', card: 'yes', nav: 'yes',
    icons: 'yes', typography: 'partial', utilities: 'yes', focus: 'yes',
  },
  astryx: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial', utilities: 'yes', focus: 'yes',
  },
  shadcn: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'partial', nav: 'yes', icons: 'partial', charts: 'yes', utilities: 'yes',
  },
  untitledui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'paid', accordion: 'paid',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes',
    steps: 'paid', nav: 'paid', icons: 'yes', typography: 'yes', charts: 'yes', utilities: 'yes', focus: 'yes',
  },
  gravity: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'partial', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial', utilities: 'yes',
  },
}

const coverageScore = (id: string) => CATEGORIES.reduce((total, category) => {
  const mark = COVERAGE[id]?.[category.id]
  return total + (mark === 'yes' ? 1 : mark === 'partial' || mark === 'paid' ? 0.5 : 0)
}, 0)

/** The coverage matrix's column order. Keep this shared with the summary
 *  matrix so a system occupies the same visual position in both views. */
export const COVERAGE_SYSTEMS = [...SYSTEMS].sort((a, b) => {
  if (a.anta) return -1
  if (b.anta) return 1

  return coverageScore(b.id) - coverageScore(a.id) || a.name.localeCompare(b.name)
})

/**
 * Per-cell deep links: for each system, the official documentation page for
 * the component behind a coverage mark, so a reader can jump straight from a
 * cell to that system's page for the job. Keyed [systemId][categoryId].
 * Anta's own column links to our component pages instead (see the coverage
 * matrix's ANTA_SLUG), so Anta isn't listed here. A marked cell with no entry
 * (a system with no dedicated page for that job — Polaris Tabs, Atlaskit Card,
 * shadcn Icons) renders as a plain, unlinked glyph.
 *
 * URLs verified against each system's live docs in July 2026; grouped
 * categories point at the primary member (choice → Checkbox, nav →
 * Breadcrumb, toast → the system's toast/notification/banner, dialog → its
 * modal, tag → its badge/chip/lozenge). Re-check on the next AS_OF refresh —
 * doc URLs move.
 */
export const COVERAGE_URLS: Record<string, Partial<Record<string, string>>> = {
  webawesome: {
    button: 'https://webawesome.com/docs/components/button/',
    textinput: 'https://webawesome.com/docs/components/input/',
    select: 'https://webawesome.com/docs/components/select/',
    combobox: 'https://webawesome.com/docs/components/combobox/',
    choice: 'https://webawesome.com/docs/components/checkbox/',
    slider: 'https://webawesome.com/docs/components/slider/',
    datetime: 'https://webawesome.com/docs/components/date-picker/',
    tabs: 'https://webawesome.com/docs/components/tab-group/',
    menu: 'https://webawesome.com/docs/components/dropdown/',
    tooltip: 'https://webawesome.com/docs/components/tooltip/',
    dialog: 'https://webawesome.com/docs/components/dialog/',
    toast: 'https://webawesome.com/docs/components/toast/',
    accordion: 'https://webawesome.com/docs/components/accordion/',
    table: 'https://webawesome.com/docs/components/data-grid/',
    tag: 'https://webawesome.com/docs/components/tag/',
    progress: 'https://webawesome.com/docs/components/progress-bar/',
    avatar: 'https://webawesome.com/docs/components/avatar/',
    card: 'https://webawesome.com/docs/components/card/',
    nav: 'https://webawesome.com/docs/components/breadcrumb/',
    icons: 'https://webawesome.com/docs/components/icon/',
    typography: 'https://webawesome.com/docs/tokens/typography/',
    charts: 'https://webawesome.com/docs/components/chart/',
    utilities: 'https://webawesome.com/docs/components/resize-observer/',
  },
  polaris: {
    button: 'https://shopify.dev/docs/api/app-home/web-components/actions/button',
    textinput: 'https://shopify.dev/docs/api/app-home/web-components/forms/text-field',
    select: 'https://shopify.dev/docs/api/app-home/web-components/forms/select',
    choice: 'https://shopify.dev/docs/api/app-home/web-components/forms/checkbox',
    datetime: 'https://shopify.dev/docs/api/app-home/web-components/forms/date-picker',
    menu: 'https://shopify.dev/docs/api/app-home/web-components/actions/menu',
    tooltip: 'https://shopify.dev/docs/api/app-home/web-components/typography-and-content/tooltip',
    dialog: 'https://shopify.dev/docs/api/app-home/web-components/overlays/modal',
    toast: 'https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/banner',
    table: 'https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/table',
    tag: 'https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/badge',
    progress: 'https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/spinner',
    avatar: 'https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/avatar',
    card: 'https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/section',
    icons: 'https://shopify.dev/docs/api/app-home/web-components/media-and-visuals/icon',
    typography: 'https://shopify.dev/docs/api/app-home/web-components/typography-and-content/text',
    utilities: 'https://shopify.dev/docs/api/app-home/web-components/layout-and-structure/box',
  },
  mui: {
    button: 'https://mui.com/material-ui/react-button/',
    textinput: 'https://mui.com/material-ui/react-text-field/',
    select: 'https://mui.com/material-ui/react-select/',
    combobox: 'https://mui.com/material-ui/react-autocomplete/',
    choice: 'https://mui.com/material-ui/react-checkbox/',
    slider: 'https://mui.com/material-ui/react-slider/',
    datetime: 'https://mui.com/x/react-date-pickers/',
    tabs: 'https://mui.com/material-ui/react-tabs/',
    menu: 'https://mui.com/material-ui/react-menu/',
    tooltip: 'https://mui.com/material-ui/react-tooltip/',
    dialog: 'https://mui.com/material-ui/react-dialog/',
    toast: 'https://mui.com/material-ui/react-snackbar/',
    accordion: 'https://mui.com/material-ui/react-accordion/',
    table: 'https://mui.com/material-ui/react-table/',
    tag: 'https://mui.com/material-ui/react-chip/',
    progress: 'https://mui.com/material-ui/react-progress/',
    avatar: 'https://mui.com/material-ui/react-avatar/',
    card: 'https://mui.com/material-ui/react-card/',
    steps: 'https://mui.com/material-ui/react-stepper/',
    nav: 'https://mui.com/material-ui/react-breadcrumbs/',
    icons: 'https://mui.com/material-ui/material-icons/',
    typography: 'https://mui.com/material-ui/react-typography/',
    charts: 'https://mui.com/x/react-charts/',
    utilities: 'https://mui.com/material-ui/react-click-away-listener/',
    focus: 'https://github.com/mui/material-ui/tree/master/packages/mui-material/src/Unstable_TrapFocus',
  },
  antd: {
    button: 'https://ant.design/components/button',
    textinput: 'https://ant.design/components/input',
    select: 'https://ant.design/components/select',
    combobox: 'https://ant.design/components/auto-complete',
    choice: 'https://ant.design/components/checkbox',
    slider: 'https://ant.design/components/slider',
    datetime: 'https://ant.design/components/date-picker',
    tabs: 'https://ant.design/components/tabs',
    menu: 'https://ant.design/components/menu',
    tooltip: 'https://ant.design/components/tooltip',
    dialog: 'https://ant.design/components/modal',
    toast: 'https://ant.design/components/message',
    accordion: 'https://ant.design/components/collapse',
    table: 'https://ant.design/components/table',
    tag: 'https://ant.design/components/tag',
    progress: 'https://ant.design/components/progress',
    avatar: 'https://ant.design/components/avatar',
    card: 'https://ant.design/components/card',
    steps: 'https://ant.design/components/steps',
    nav: 'https://ant.design/components/breadcrumb',
    icons: 'https://ant.design/components/icon',
    typography: 'https://ant.design/components/typography',
    charts: 'https://charts.ant.design/en',
  },
  mantine: {
    button: 'https://mantine.dev/core/button/',
    textinput: 'https://mantine.dev/core/text-input/',
    select: 'https://mantine.dev/core/select/',
    combobox: 'https://mantine.dev/core/autocomplete/',
    choice: 'https://mantine.dev/core/checkbox/',
    slider: 'https://mantine.dev/core/slider/',
    datetime: 'https://mantine.dev/dates/date-picker-input/',
    tabs: 'https://mantine.dev/core/tabs/',
    menu: 'https://mantine.dev/core/menu/',
    tooltip: 'https://mantine.dev/core/tooltip/',
    dialog: 'https://mantine.dev/core/modal/',
    toast: 'https://mantine.dev/x/notifications/',
    accordion: 'https://mantine.dev/core/accordion/',
    table: 'https://mantine.dev/core/table/',
    tag: 'https://mantine.dev/core/badge/',
    progress: 'https://mantine.dev/core/progress/',
    avatar: 'https://mantine.dev/core/avatar/',
    card: 'https://mantine.dev/core/card/',
    steps: 'https://mantine.dev/core/stepper/',
    nav: 'https://mantine.dev/core/breadcrumbs/',
    icons: 'https://mantine.dev/guides/icons/',
    typography: 'https://mantine.dev/core/typography/',
    charts: 'https://mantine.dev/charts/getting-started/',
    utilities: 'https://mantine.dev/hooks/use-resize-observer/',
    focus: 'https://mantine.dev/core/focus-trap/',
  },
  carbon: {
    button: 'https://carbondesignsystem.com/components/button/usage/',
    textinput: 'https://carbondesignsystem.com/components/text-input/usage/',
    select: 'https://carbondesignsystem.com/components/dropdown/usage/',
    combobox: 'https://carbondesignsystem.com/components/dropdown/usage/',
    choice: 'https://carbondesignsystem.com/components/checkbox/usage/',
    slider: 'https://carbondesignsystem.com/components/slider/usage/',
    datetime: 'https://carbondesignsystem.com/components/date-picker/usage/',
    tabs: 'https://carbondesignsystem.com/components/tabs/usage/',
    menu: 'https://carbondesignsystem.com/components/overflow-menu/usage/',
    tooltip: 'https://carbondesignsystem.com/components/tooltip/usage/',
    dialog: 'https://carbondesignsystem.com/components/modal/usage/',
    toast: 'https://carbondesignsystem.com/components/notification/usage/',
    accordion: 'https://carbondesignsystem.com/components/accordion/usage/',
    table: 'https://carbondesignsystem.com/components/data-table/usage/',
    tag: 'https://carbondesignsystem.com/components/tag/usage/',
    progress: 'https://carbondesignsystem.com/components/progress-bar/usage/',
    card: 'https://carbondesignsystem.com/components/tile/usage/',
    steps: 'https://carbondesignsystem.com/components/progress-indicator/usage/',
    nav: 'https://carbondesignsystem.com/components/breadcrumb/usage/',
    icons: 'https://carbondesignsystem.com/elements/icons/usage/',
    typography: 'https://carbondesignsystem.com/elements/typography/overview/',
    charts: 'https://charts.carbondesignsystem.com/',
  },
  atlassian: {
    button: 'https://atlassian.design/components/button/examples',
    textinput: 'https://atlassian.design/components/textfield/examples',
    select: 'https://atlassian.design/components/select/examples',
    combobox: 'https://atlassian.design/components/select/async-select/examples',
    choice: 'https://atlassian.design/components/checkbox/examples',
    slider: 'https://atlassian.design/components/range/examples',
    datetime: 'https://atlassian.design/components/datetime-picker/examples',
    tabs: 'https://atlassian.design/components/tabs/examples',
    menu: 'https://atlassian.design/components/menu/examples',
    tooltip: 'https://atlassian.design/components/tooltip/examples',
    dialog: 'https://atlassian.design/components/modal-dialog/examples',
    toast: 'https://atlassian.design/components/flag/examples',
    table: 'https://atlassian.design/components/dynamic-table/examples',
    tag: 'https://atlassian.design/components/tag/examples',
    progress: 'https://atlassian.design/components/progress-bar/examples',
    avatar: 'https://atlassian.design/components/avatar/examples',
    steps: 'https://atlassian.design/components/progress-tracker/examples',
    nav: 'https://atlassian.design/components/breadcrumbs/examples',
    icons: 'https://atlassian.design/components/icon/examples',
    typography: 'https://atlassian.design/components/heading/examples',
    utilities: 'https://atlassian.design/components/pragmatic-drag-and-drop/core-package/',
  },
  blueprint: {
    button: 'https://blueprintjs.com/docs/#core/components/button',
    textinput: 'https://blueprintjs.com/docs/#core/components/input-group',
    select: 'https://blueprintjs.com/docs/#select/select-component',
    combobox: 'https://blueprintjs.com/docs/#select/suggest',
    choice: 'https://blueprintjs.com/docs/#core/components/checkbox',
    slider: 'https://blueprintjs.com/docs/#core/components/sliders',
    datetime: 'https://blueprintjs.com/docs/#datetime/date-picker',
    tabs: 'https://blueprintjs.com/docs/#core/components/tabs',
    menu: 'https://blueprintjs.com/docs/#core/components/menu',
    tooltip: 'https://blueprintjs.com/docs/#core/components/tooltip',
    dialog: 'https://blueprintjs.com/docs/#core/components/dialog',
    toast: 'https://blueprintjs.com/docs/#core/components/toast',
    accordion: 'https://blueprintjs.com/docs/#core/components/collapse',
    table: 'https://blueprintjs.com/docs/#table',
    tag: 'https://blueprintjs.com/docs/#core/components/tag',
    progress: 'https://blueprintjs.com/docs/#core/components/progress-bar',
    card: 'https://blueprintjs.com/docs/#core/components/card',
    nav: 'https://blueprintjs.com/docs/#core/components/breadcrumbs',
    icons: 'https://blueprintjs.com/docs/#core/components/icon',
    typography: 'https://blueprintjs.com/docs/#core/typography',
    utilities: 'https://blueprintjs.com/docs/#core/components/resize-sensor',
    focus: 'https://github.com/palantir/blueprint/blob/develop/packages/core/src/accessibility/focusStyleManager.ts',
  },
  astryx: {
    button: 'https://astryx.atmeta.com/components/Button',
    textinput: 'https://astryx.atmeta.com/components/TextInput',
    select: 'https://astryx.atmeta.com/components/Selector',
    combobox: 'https://astryx.atmeta.com/components/Typeahead',
    choice: 'https://astryx.atmeta.com/components/CheckboxInput',
    slider: 'https://astryx.atmeta.com/components/Slider',
    datetime: 'https://astryx.atmeta.com/components/DateInput',
    tabs: 'https://astryx.atmeta.com/components/TabList',
    menu: 'https://astryx.atmeta.com/components/DropdownMenu',
    tooltip: 'https://astryx.atmeta.com/components/Tooltip',
    dialog: 'https://astryx.atmeta.com/components/Dialog',
    toast: 'https://astryx.atmeta.com/components/Toast',
    accordion: 'https://astryx.atmeta.com/components/Collapsible',
    table: 'https://astryx.atmeta.com/components/Table',
    tag: 'https://astryx.atmeta.com/components/Badge',
    progress: 'https://astryx.atmeta.com/components/ProgressBar',
    avatar: 'https://astryx.atmeta.com/components/Avatar',
    card: 'https://astryx.atmeta.com/components/Card',
    nav: 'https://astryx.atmeta.com/components/Breadcrumbs',
    icons: 'https://astryx.atmeta.com/components/Icon',
    typography: 'https://astryx.atmeta.com/components/Text',
    utilities: 'https://astryx.atmeta.com/components/useScrollOverflow',
    focus: 'https://astryx.atmeta.com/components/useFocusTrap',
  },
  shadcn: {
    button: 'https://ui.shadcn.com/docs/components/button',
    textinput: 'https://ui.shadcn.com/docs/components/input',
    select: 'https://ui.shadcn.com/docs/components/select',
    combobox: 'https://ui.shadcn.com/docs/components/combobox',
    choice: 'https://ui.shadcn.com/docs/components/checkbox',
    slider: 'https://ui.shadcn.com/docs/components/slider',
    datetime: 'https://ui.shadcn.com/docs/components/date-picker',
    tabs: 'https://ui.shadcn.com/docs/components/tabs',
    menu: 'https://ui.shadcn.com/docs/components/dropdown-menu',
    tooltip: 'https://ui.shadcn.com/docs/components/tooltip',
    dialog: 'https://ui.shadcn.com/docs/components/dialog',
    toast: 'https://ui.shadcn.com/docs/components/sonner',
    accordion: 'https://ui.shadcn.com/docs/components/accordion',
    table: 'https://ui.shadcn.com/docs/components/table',
    tag: 'https://ui.shadcn.com/docs/components/badge',
    progress: 'https://ui.shadcn.com/docs/components/progress',
    avatar: 'https://ui.shadcn.com/docs/components/avatar',
    card: 'https://ui.shadcn.com/docs/components/card',
    nav: 'https://ui.shadcn.com/docs/components/breadcrumb',
    charts: 'https://ui.shadcn.com/charts',
    utilities: 'https://ui.shadcn.com/docs/components/scroll-area',
  },
  untitledui: {
    button: 'https://www.untitledui.com/react/components/buttons',
    textinput: 'https://www.untitledui.com/react/components/inputs',
    select: 'https://www.untitledui.com/react/components/select',
    combobox: 'https://www.untitledui.com/react/components/select',
    choice: 'https://www.untitledui.com/react/components/checkboxes',
    slider: 'https://www.untitledui.com/react/components/sliders',
    datetime: 'https://www.untitledui.com/react/components/date-pickers',
    tabs: 'https://www.untitledui.com/react/components/tabs',
    menu: 'https://www.untitledui.com/react/components/dropdowns',
    tooltip: 'https://www.untitledui.com/react/components/tooltips',
    dialog: 'https://www.untitledui.com/react/components/modals',
    toast: 'https://www.untitledui.com/react/components/notifications',
    accordion: 'https://www.untitledui.com/react/marketing/faq-sections/faq-accordion-04-brand',
    table: 'https://www.untitledui.com/react/components/tables',
    tag: 'https://www.untitledui.com/react/components/tags',
    progress: 'https://www.untitledui.com/react/components/progress-indicators',
    avatar: 'https://www.untitledui.com/react/components/avatars',
    steps: 'https://www.untitledui.com/react/components/progress-steps',
    nav: 'https://www.untitledui.com/react/components/breadcrumbs',
    icons: 'https://www.untitledui.com/react/docs/icons',
    typography: 'https://www.untitledui.com/react/docs/typography',
    charts: 'https://www.untitledui.com/react/components/line-bar-charts',
    utilities: 'https://react-aria.adobe.com/useMove',
    focus: 'https://react-aria.adobe.com/FocusScope',
  },
  gravity: {
    button: 'https://gravity-ui.com/components/uikit/button',
    textinput: 'https://gravity-ui.com/components/uikit/text-input',
    select: 'https://gravity-ui.com/components/uikit/select',
    combobox: 'https://gravity-ui.com/components/uikit/select',
    choice: 'https://gravity-ui.com/components/uikit/checkbox',
    slider: 'https://gravity-ui.com/components/uikit/slider',
    datetime: 'https://gravity-ui.com/components/date-components/date-picker',
    tabs: 'https://gravity-ui.com/components/uikit/tabs',
    menu: 'https://gravity-ui.com/components/uikit/dropdown-menu',
    tooltip: 'https://gravity-ui.com/components/uikit/tooltip',
    dialog: 'https://gravity-ui.com/components/uikit/modal',
    toast: 'https://gravity-ui.com/components/uikit/toaster',
    accordion: 'https://gravity-ui.com/components/uikit/disclosure',
    table: 'https://gravity-ui.com/components/uikit/table',
    tag: 'https://gravity-ui.com/components/uikit/label',
    progress: 'https://gravity-ui.com/components/uikit/progress',
    avatar: 'https://gravity-ui.com/components/uikit/avatar',
    card: 'https://gravity-ui.com/components/uikit/card',
    steps: 'https://gravity-ui.com/components/uikit/stepper',
    nav: 'https://gravity-ui.com/components/uikit/breadcrumbs',
    icons: 'https://gravity-ui.com/components/uikit/icon',
    typography: 'https://gravity-ui.com/components/uikit/text',
    utilities: 'https://github.com/gravity-ui/uikit/tree/main/src/hooks/useResizeObserver',
  },
}

/**
 * Data behind the /comparison page. One source of truth for the two
 * matrices (at-a-glance + component coverage) and the per-system pros/cons
 * cards, so the numbers can't drift between sections.
 *
 * Versions are a snapshot verified against npm / official docs in July 2026
 * (see `AS_OF`). The fixed-package size figures come from downloaded npm
 * artifacts: a full-package ESM bundle minified with esbuild, with React and
 * React DOM external, then gzip level 9 applied to each emitted JS and CSS
 * file. Polaris is a dated gzip-9 CDN snapshot rather than a package figure.
 * They date quickly; re-check before quoting them elsewhere.
 * Coverage marks describe *shipped* components, grouping variants that cover
 * one job into a single cell (a Dialog / Modal / Drawer family is one mark).
 * Marks are honest, not generous: `partial` means "basic or community-only",
 * not "counts if you squint".
 */

export const AS_OF = 'July 2026'

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
  /** What the size includes and excludes. */
  bundleIncludes: string
  /** Browser policy for this version. */
  browsers: string
  /** Earliest release year in a documented fixed browser floor. Omitted for
   *  rolling policies and systems that do not publish a versioned floor. */
  browserBaselineYear?: number
  /** Approximate year implied by the current shipped build or a platform
   *  feature it requires. It is displayed with `~`, never as a published
   *  browser-support promise or fixed minimum. */
  browserApproximateYear?: number
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
    version: '@antadesign/anta 0.3.17',
    docs: 'https://anta.design',
    tagline: 'Framework-agnostic web components with optional React/Preact wrappers and no style runtime.',
    kind: 'Styled web components + JSX wrappers',
    frameworks: 'React/Preact wrappers of Web components',
    styling: 'Plain CSS + CSS-variable tokens',
    license: 'MIT',
    bundleSize: "~100 KiB gzipped",
    bundleIncludes: "All JSX wrappers, custom elements, component CSS, tokens, and reset CSS; React, the branded theme, and stickers excluded. Selective imports are smaller.",
    browsers: "Chrome / Edge 125 (2024), Safari 17.4 (2024), and Firefox 126 (2024), or later. Requires custom elements, ElementInternals, Popover, and modern CSS.",
    browserBaselineYear: 2024,
    pros: [
      'Runs in React, Preact, and plain HTML; JSX wrappers are optional.',
      'Components do not mutate host attributes, so they work with worker-thread and reactive renderers.',
      'Plain CSS in one @layer avoids a style runtime and specificity fights.',
      'Global tokens cover color roles, fonts, and focus. Components expose their remaining CSS variables locally.',
      'OKLCH tones use the same token system in light and dark mode.',
      'Per-element imports register only the component you use.',
    ],
    cons: [
      'Young and small: about 20 components.',
      'Table and plotting libraries are planned companion packages.',
      'A 0.x release from one organization has a shorter track record than established systems.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    short: 'WA',
    version: '@awesome.me/webawesome 3.10.0',
    docs: 'https://webawesome.com',
    tagline: "Font Awesome's framework-agnostic web components and CSS framework, succeeding Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Web components',
    frameworksNote: 'React, Vue, Angular, Svelte guides',
    styling: 'CSS framework + CSS variables',
    license: 'MIT core + paid Pro tier',
    bundleSize: "~190 KiB gzipped",
    bundleIncludes: "All free components, Lit runtime, and base CSS; Pro components and web fonts excluded. Selective imports are smaller.",
    browsers: 'Web Awesome officially supports the latest two major versions of Chrome, Safari, Edge, Firefox, and Opera. Its v3.10 production bundle targets ES2020; it does not publish a fixed browser floor.',
    browserApproximateYear: 2020,
    pros: [
      'Works in any stack or plain HTML without a build step.',
      'Broad components, utility and layout CSS, and Font Awesome icons.',
      'ElementInternals form controls support FormData, validation, and reset.',
      'CSS variables and `::part()` support theming.',
      'Backed by Font Awesome, with monthly releases since October 2025.',
    ],
    cons: [
      'Combobox, date and file inputs, toasts, charts, and video require Pro.',
      'Lit is a runtime dependency alongside React or Vue.',
      'Its own docs describe SSR support as experimental.',
    ],
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    short: 'Polaris',
    version: 'polaris.js CDN, always latest',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline: "Shopify's web-component system for apps that must match Shopify Admin.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Web components',
    styling: 'Locked to the Shopify look',
    license: 'Restricted (Shopify apps)',
    bundleSize: "~120 KiB gzipped",
    bundleIncludes: "polaris.js on 31 July 2026; component CSS is embedded in the script. It appends 0.52 KiB-gzip Inter CSS, then loads a matching Inter WOFF2 subset (83.3 KiB Latin) and SVG icons on demand. The CDN is mutable.",
    browsers: 'Shopify does not publish a standalone floor for Polaris. The current CDN script uses `:has()`, container queries, and the Popover API; the last of those reached all major engines in 2024.',
    browserApproximateYear: 2024,
    pros: [
      'Framework-agnostic web components from a major platform.',
      'One script tag matches Shopify Admin and merchant brand settings.',
      'Shopify measured 40–85% smaller checkout-extension bundles after leaving React.',
      'Built-in accessibility warnings flag missing required props.',
    ],
    cons: [
      'The CDN cannot be pinned; unannounced updates have broken production apps.',
      'Styling is intentionally locked to Shopify, not your own brand.',
      'It still lacks features from the deprecated React library, including bulk table selection and multi-select.',
      'The license applies only to apps that integrate with Shopify.',
    ],
  },
  {
    id: 'mui',
    name: 'MUI (Material UI)',
    short: 'MUI',
    version: '@mui/material 9.2.0',
    docs: 'https://mui.com/material-ui/',
    tagline: "Google's Material Design implementation for React, with extensive theming.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS-in-JS (Emotion)',
    license: 'MIT core + paid MUI X',
    bundleSize: "~170 KiB gzipped",
    bundleIncludes: "All Material UI core exports and the Emotion style runtime; React, icons, MUI X, date adapters, and application code excluded. Selective imports are smaller.",
    browsers: 'Chrome 117 (2023), Edge 121 (2024), Firefox 121 (2024), and Safari 17.0 (2023), or later.',
    browserBaselineYear: 2023,
    pros: [
      'A large component set, plus MUI X data grid, charts, and date pickers.',
      'The largest ecosystem here: documentation, themes, templates, and hiring.',
      'Themes reach component slots through `styleOverrides` and variants.',
      'v9 offers opt-in CSS-variable themes with OKLCH `color-mix()` states.',
    ],
    cons: [
      'Moving far from Material requires slot-by-slot overrides; most MUI apps still read as Material.',
      'Emotion resolves styles at runtime. The planned zero-runtime Pigment CSS is paused.',
      'React-only; data grid, date-range pickers, and advanced charts have paid MUI X tiers.',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    short: 'Ant',
    version: 'antd 6.5.2',
    docs: 'https://ant.design',
    tagline: 'An enterprise React library for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React',
    frameworksNote: 'Angular, Vue community ports',
    styling: 'CSS-in-JS + CSS variables (v6)',
    license: 'MIT',
    bundleSize: "~470 KiB gzipped",
    bundleIncludes: "All `antd` exports and its CSS-in-JS runtime; React, icons, charts, and application code excluded. Selective imports are smaller.",
    browsers: 'v6 supports modern browsers and enables CSS variables by default. Its build transpiles against the rolling Browserslist `defaults` query, while shipped layout components use native `ResizeObserver` without a fallback, which reached all major engines in 2020.',
    browserApproximateYear: 2020,
    pros: [
      'One of the largest component sets, including Table, Form, Transfer, and Cascader.',
      'Built for admin and data-heavy apps, often without a separate form library.',
      'Token-based themes include dark and compact modes.',
      'A mature ecosystem with Pro components, AntV charts, and TypeScript support.',
    ],
    cons: [
      'Accessibility lacks a consolidated target and documentation; fixes land component by component.',
      'Imports need care to limit the icons, dayjs, and rc-component payload.',
      "Themes change color, radius, and density, but the result still reads as Ant Design.",
      'React-only; Vue and Angular versions are separate community projects.',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    version: '@mantine/core 9.4.2',
    docs: 'https://mantine.dev',
    tagline: 'A React library with extensive hooks and official form, date, and chart packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS Modules + CSS variables',
    license: 'MIT',
    bundleSize: "~210 KiB gzipped",
    bundleIncludes: "All `@mantine/core` exports, `@mantine/hooks`, and core CSS; React and separate dates, charts, forms, and notifications packages excluded. Selective imports are smaller.",
    browsers: 'Tested on Chromium 108 (2022), Firefox 101 (2022), and Safari 15.4 (2022), or later.',
    browserBaselineYear: 2022,
    pros: [
      '142 components and 82 hooks; forms, dates, charts, notifications, and rich text are official packages.',
      'CSS Modules and CSS variables avoid runtime CSS-in-JS.',
      'Every component documents its Styles API, with unstyled and headless modes.',
      'Weekly patches, fast issue triage, and strong TypeScript documentation.',
    ],
    cons: [
      'Current versions require React 19.2+; React 18 stays on v8.',
      'React-only.',
      'A full `@mantine/core` import with its required hooks and CSS is about 210 KiB gzipped, so tree-shaking matters.',
      'Development is largely led by one active, sponsor-funded maintainer.',
    ],
  },
  {
    id: 'carbon',
    name: 'Carbon',
    version: '@carbon/react 1.112.0',
    docs: 'https://carbondesignsystem.com',
    tagline: "IBM's enterprise design system for React and first-party web components.",
    kind: 'Styled React (+ web components)',
    frameworks: 'React + Lit web components',
    frameworksNote: 'Angular, Vue, Svelte community',
    styling: 'Sass + CSS variables',
    license: 'Apache-2.0',
    bundleSize: "~300 KiB gzipped",
    bundleIncludes: "All `@carbon/react` exports and Carbon's compiled CSS; React, icons, charts, and web components excluded. Selective imports are smaller.",
    browsers: 'Carbon supports the latest stable Edge, Firefox, Chrome, and Safari releases. Its shipped CSS uses `:has()` and container queries, which reached all major engines in 2023.',
    browserApproximateYear: 2023,
    pros: [
      'Publishes component accessibility results, including manual screen-reader checks mapped to WCAG.',
      'Strong for data-dense enterprise UIs, with data-table and app-shell components.',
      'React and Lit web components ship first-party on the same release cadence.',
      'Theme-scoped role tokens support four built-in themes.',
    ],
    cons: [
      'Component styles require Dart Sass; precompiled CSS covers only tokens, grid, and type.',
      'Moving away from IBM Plex requires Sass recompilation or many class overrides.',
      'Its large, multi-package surface has a matching learning curve.',
      'Angular, Vue, and Svelte implementations are community-maintained.',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Atlaskit)',
    short: 'Atlaskit',
    version: '@atlaskit/tokens 16.3.0',
    docs: 'https://atlassian.design',
    tagline: 'The Jira, Confluence, and Trello system, published as independently versioned `@atlaskit` packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    license: 'Apache-2.0 code, Atlassian-scoped terms',
    bundleSize: "~600 KiB gzipped",
    bundleIncludes: "57 public Design System packages; tables, icons, editors, product packages, and React excluded. Only imported packages ship.",
    browsers: 'Atlaskit follows the browsers supported by Atlassian Cloud and publishes no fixed floor. Its current compiled controls use CSS variables and `:focus-visible`, which reached all major engines in 2022.',
    browserApproximateYear: 2022,
    pros: [
      'Proven in Atlassian products, with tokens and Figma libraries aligned to the code.',
      'Build-time Compiled CSS-in-JS keeps the style runtime near zero.',
      'Deep collaboration patterns, including pragmatic drag and drop.',
      'A WCAG 2.1 AA target with published conformance reports.',
    ],
    cons: [
      'You must keep dozens of `@atlaskit` package versions aligned.',
      'Compiled CSS-in-JS needs Babel or SWC and style extraction setup.',
      'Terms limit use to products that integrate with Atlassian, and the docs assume that context.',
      'React-only.',
    ],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    version: '@blueprintjs/core 6.17.2',
    docs: 'https://blueprintjs.com',
    tagline: "Palantir's React toolkit for complex, data-dense desktop interfaces.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass-compiled CSS (bp6- classes)',
    license: 'Apache-2.0',
    bundleSize: "~350 KiB gzipped",
    bundleIncludes: "All `@blueprintjs/core` exports and compiled core CSS; React and the separate Table, Select, and Datetime packages excluded. Selective imports are smaller.",
    browsers: 'Blueprint publishes no current versioned floor and is desktop-first. Its current compiled core CSS uses `color-mix()`, which reached all major engines in 2023.',
    browserApproximateYear: 2023,
    pros: [
      'Built for dense desktop tools: a virtualized Table, Omnibar, and dual-calendar date picker.',
      'Maintained by a Palantir team and in production there since 2016.',
      'Thorough documentation and consistent keyboard behavior.',
    ],
    cons: [
      'Desktop-first by design; touch and mobile are out of scope.',
      'Restyling requires Sass recompilation or `bp6-` class overrides; dark mode is a class toggle.',
      'React-only.',
    ],
  },
  {
    id: 'astryx',
    name: 'Astryx',
    version: '@astryxdesign/core 0.1.8',
    docs: 'https://astryx.atmeta.com',
    tagline: "Meta's React design system on StyleX, with precompiled CSS and first-party AI-agent tooling.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'StyleX (precompiled atomic CSS)',
    license: 'MIT',
    bundleSize: "~260 KiB gzipped",
    bundleIncludes: "All core exports, StyleX runtime, and `astryx.css`; React excluded. Selective source builds are smaller.",
    browsers: 'Functional support: Chrome / Edge 114 (2024), Safari 17 (2023), and Firefox 125 (2024), or later. Its full-fidelity target is the rolling 2026 web baseline.',
    browserBaselineYear: 2024,
    pros: [
      'About 100 stable components, including an enterprise Table and WebGL chart primitive.',
      'Precompiled CSS needs no StyleX build step; source compilation is optional for tree-shaking.',
      'Agent tooling includes an MCP server, `llms.txt`, and a CLI for context files and source ejection.',
      'Developed within Meta before the June 2026 public release, with frequent updates since.',
    ],
    cons: [
      'Custom brand tokens do not reach every component; some fall back to Astryx defaults.',
      'React-only, and requires React 19.',
      'Accessibility work appears in releases, but there is no conformance statement or external audit yet.',
    ],
  },
  {
    id: 'gravity',
    name: 'Gravity UI',
    short: 'Gravity',
    version: '@gravity-ui/uikit 7.47.1',
    docs: 'https://gravity-ui.com',
    tagline: "Yandex's open-source React system, with `@gravity-ui` packages, Figma, and Storybook.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS (BEM classes) + CSS variables',
    license: 'MIT',
    bundleSize: "~220 KiB gzipped",
    bundleIncludes: "All UIKit exports and UIKit CSS; React, icons, dates, charts, and data-table packages excluded. Selective imports are smaller.",
    browsers: 'Web Baseline widely available on 1 January 2025, with downstream browsers.',
    browserBaselineYear: 2025,
    pros: [
      'A broad core plus packages for dates, icons, charts, navigation, and a headless data table.',
      'Built-in light, dark, and high-contrast themes, with CSS variables and a hosted theme editor.',
      'Screen-reader audits drive documented keyboard and focus fixes.',
      'Supports React 16.14 through 19 in one release.',
    ],
    cons: [
      'React-only.',
      'Dates, charts, and the data table add separate dependencies.',
      'There is little verified adoption outside Yandex products.',
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
    version: 'Base UI registry @ 705ce59',
    docs: 'https://ui.shadcn.com',
    tagline: 'Tailwind-styled source copied into your repo by CLI, using Base UI primitives by default.',
    kind: 'Copy-paste React source on Base UI',
    frameworks: 'React',
    frameworksNote: 'Vue, Svelte community ports',
    styling: 'Tailwind + CSS variables',
    license: 'MIT',
    bundleSize: "~350 KiB gzipped",
    bundleIncludes: "All 61 Base UI registry components and generated Tailwind CSS; React and Lucide excluded. Only selected source ships.",
    browsers: "Depends on the selected primitives. Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later.",
    browserBaselineYear: 2024,
    pros: [
      'The source lives in your repo, with no black-box dependency or version lock.',
      'Base UI supplies accessible, composable primitives with a render-prop API.',
      'AI tools such as v0 and Cursor commonly generate shadcn-style code.',
      'A large ecosystem of themes, blocks, and community registries.',
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
    version: 'React app source @ eaee6a5',
    docs: 'https://www.untitledui.com/react',
    tagline: 'A large React and Tailwind source collection on React Aria, paired with the Untitled UI Figma kit.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    styling: 'Tailwind CSS + React Aria',
    license: 'MIT core + paid Pro tier',
    bundleSize: "~410 KiB gzipped",
    bundleIncludes: "102 app source files (`base` + `application`), React Aria, and generated Tailwind CSS; React, Next, and icons excluded. Only selected source ships.",
    browsers: "Tailwind CSS 4 requires Safari 16.4 (2023), Chrome 111 (2023), and Firefox 128 (2024), or later. React Aria can add feature-specific requirements.",
    browserBaselineYear: 2024,
    pros: [
      'A broad React Aria component set copied into your repo without a runtime dependency.',
      'Tailwind v4 styling and a synced Figma kit keep design and code aligned.',
      'Charts use Recharts rather than native chart components.',
    ],
    cons: [
      'React-only, with React 19 and Tailwind CSS 4 required.',
      'Tables render as regular HTML tables with horizontal scrolling, not virtualized data grids.',
      'Full-page examples, extra icon styles, and the Figma kit require paid tiers.',
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
  { id: 'nav', label: 'Nav helpers', members: 'Breadcrumb, pagination' },
  { id: 'icons', label: 'Icons', members: 'Bundled icon set' },
  { id: 'typography', label: 'Typography', members: 'Text / title components' },
  { id: 'charts', label: 'Charts', members: 'First-party data viz' },
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
    icons: 'yes', typography: 'yes',
  },
  webawesome: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'paid',
    choice: 'yes', slider: 'yes', datetime: 'paid', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'paid', accordion: 'yes',
    tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes', nav: 'partial',
    icons: 'yes', typography: 'partial', charts: 'paid',
  },
  polaris: {
    button: 'yes', textinput: 'yes', select: 'yes', choice: 'yes',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes',
    dialog: 'partial', toast: 'partial', table: 'yes', tag: 'yes',
    progress: 'partial', avatar: 'yes', card: 'yes', icons: 'yes',
    typography: 'yes',
  },
  mui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes',
  },
  antd: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes',
  },
  mantine: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'partial', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'partial', typography: 'yes', charts: 'yes',
  },
  carbon: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'partial', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'partial', charts: 'yes',
  },
  atlassian: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', table: 'yes', tag: 'yes',
    progress: 'yes', avatar: 'yes', card: 'partial',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'partial',
  },
  blueprint: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', card: 'yes', nav: 'yes',
    icons: 'yes', typography: 'partial',
  },
  astryx: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial',
  },
  shadcn: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'partial', nav: 'yes', icons: 'partial', charts: 'yes',
  },
  untitledui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'paid', accordion: 'paid',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes',
    steps: 'paid', nav: 'paid', icons: 'yes', typography: 'yes', charts: 'yes',
  },
  gravity: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'partial', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    steps: 'yes', nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial',
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
    tag: 'https://webawesome.com/docs/components/tag/',
    progress: 'https://webawesome.com/docs/components/progress-bar/',
    avatar: 'https://webawesome.com/docs/components/avatar/',
    card: 'https://webawesome.com/docs/components/card/',
    nav: 'https://webawesome.com/docs/components/breadcrumb/',
    icons: 'https://webawesome.com/docs/components/icon/',
    typography: 'https://webawesome.com/docs/tokens/typography/',
    charts: 'https://webawesome.com/docs/components/chart/',
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
  },
}

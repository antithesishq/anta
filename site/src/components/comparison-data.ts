/**
 * Data behind the /comparison page. One source of truth for the two
 * matrices (at-a-glance + component coverage) and the per-system pros/cons
 * cards, so the numbers can't drift between sections.
 *
 * Versions are a snapshot verified against npm / official docs in July 2026
 * (see `AS_OF`). They date quickly; re-check before quoting them elsewhere.
 * Coverage marks describe *shipped* components, grouping variants that cover
 * one job into a single cell (a Dialog / Modal / Drawer family is one mark).
 * Marks are honest, not generous: `partial` means "basic or community-only",
 * not "counts if you squint".
 */

export const AS_OF = 'July 2026'

export type Mark = 'yes' | 'partial' | 'no' | 'paid'

export interface System {
  /** Short key, also the coverage-column id. */
  id: string
  name: string
  /** Compact label for the matrix column headers, where horizontal space is
   *  tight. Falls back to `name` (used verbatim on the pros/cons cards). */
  short?: string
  /** Coverage-column width tier: `narrow` (40px), `regular` (60px, the
   *  default when omitted), or `wide` (reserved). Short-named systems go
   *  `narrow`; the rest stay `regular`. */
  width?: 'narrow' | 'regular' | 'wide'
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
    width: 'narrow',
    version: '@antadesign/anta 0.3.12',
    docs: 'https://anta.design',
    tagline:
      'Framework-agnostic web components with thin React/Preact wrappers, a tiny CSS-variable token set, and no style or animation runtime.',
    kind: 'Styled web components + JSX wrappers',
    frameworks: 'React/Preact wrappers of Web components',
    styling: 'Plain CSS + CSS-variable tokens',
    license: 'MIT',
    pros: [
      'Web components run in React, Preact, or plain HTML; the JSX wrappers are optional.',
      'Components never mutate their own host attributes, so they render correctly from a Worker thread or any reactive engine.',
      'No style or animation runtime. Styling is plain CSS in a single @layer, so a consumer rule overrides any default without a specificity fight.',
      'Global tokens stop at color roles for text, background, and border, plus fonts and one focus ring. Everything else is a per-component CSS variable.',
      'oklch color throughout, so tone tuning stays perceptually stable and dark mode falls out of the same tokens.',
      'Per-element imports register one component at a time; the one animation dependency, Lottie, lives in the separate stickers package.',
    ],
    cons: [
      'Young and small: ~20 components, with no toast, slider, or avatar yet.',
      'Table and plot libraries are upcoming companion packages; neither has shipped.',
      'One organization at an early version (0.x), with a shorter track record than the incumbents.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    short: 'WA',
    width: 'narrow',
    version: '@awesome.me/webawesome 3.10.0',
    docs: 'https://webawesome.com',
    tagline:
      "Font Awesome's framework-agnostic web components and CSS framework, the successor to Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Web components',
    frameworksNote: 'React, Vue, Angular, Svelte guides',
    styling: 'CSS framework + ::part() + CSS variables',
    license: 'MIT core + paid Pro tier',
    pros: [
      'Web components that work in any stack or plain HTML, with no build step required.',
      'A broad component set, a utility and layout CSS framework, and Font Awesome icon integration.',
      'Form controls participate in native forms through ElementInternals: FormData, validation, and reset work without shims.',
      'CSS-variable and ::part() theming.',
      'Backed by Font Awesome, stable since October 2025 with monthly releases.',
    ],
    cons: [
      'Combobox, date and file inputs, toasts, charts, and video sit in the paid Pro tier.',
      'Ships Lit as a runtime dependency, so a React or Vue app runs a second rendering library alongside its own.',
      'SSR support is experimental, by its own docs.',
    ],
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    short: 'Polaris',
    version: 'polaris.js CDN, always latest',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline:
      "Shopify's system for apps that must look native inside Shopify Admin, shipped as web components from a Shopify-hosted script.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Web components',
    styling: 'Locked to the Shopify look',
    license: 'Restricted (Shopify apps)',
    pros: [
      'Framework-agnostic web components, a rare first-party example from a major platform.',
      "One script tag, no install or build; apps match Shopify Admin and the merchant's brand settings automatically.",
      'Shopify measured 40–85% smaller bundles after moving its checkout extensions from the React library.',
      'Built-in accessibility with developer warnings for missing a11y props.',
    ],
    cons: [
      'The CDN always serves the latest version; there is no pinning, and unannounced updates have broken production apps.',
      "Styling can't be overridden by design, so it can't match your own brand.",
      'Still behind the deprecated React library on some features: bulk table selection, multi-select, skeletons.',
      'The license scopes use to apps that integrate with Shopify.',
    ],
  },
  {
    id: 'mui',
    name: 'MUI (Material UI)',
    short: 'MUI',
    width: 'narrow',
    version: '@mui/material 9.2.0',
    docs: 'https://mui.com/material-ui/',
    tagline:
      "The dominant React implementation of Google's Material Design, with a deep theming system.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS-in-JS (Emotion)',
    license: 'MIT core + paid MUI X',
    pros: [
      'A large component surface out of the box, plus MUI X for data grid, charts, and date pickers.',
      'The largest ecosystem here: documentation, themes, templates, and hiring pool.',
      'The theme reaches every component slot via styleOverrides and variants.',
      'Opt-in CSS-variable theming derives hover and active shades with color-mix() in oklch (v9).',
    ],
    cons: [
      'A full departure from the Material look means styleOverrides for each slot of each component you use; most teams stop at the theme, so MUI apps tend to read as Material.',
      'Styles resolve through Emotion at render time; Pigment CSS, the planned zero-runtime engine, has been paused since early 2025.',
      'React-only, and the data grid, date-range pickers, and advanced charts sit in paid MUI X tiers.',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    short: 'Ant',
    width: 'narrow',
    version: 'antd 6.5.2',
    docs: 'https://ant.design',
    tagline:
      'An enterprise React library, strong for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React',
    frameworksNote: 'Angular, Vue community ports',
    styling: 'CSS-in-JS + CSS variables (v6)',
    license: 'MIT',
    pros: [
      'One of the largest component sets, with heavy-duty Table, Form, Transfer, and Cascader.',
      'Admin and data-heavy apps work out of the box; many teams skip a separate form library.',
      'Token-based theming with derived algorithms; dark and compact modes ship built in.',
      'A mature ecosystem: Pro components, AntV charts, first-class TypeScript.',
    ],
    cons: [
      'Accessibility lags peers: no consolidated docs or WCAG target, and fixes land component by component.',
      'A large JS payload (icons, dayjs, the rc-component tree) unless imports stay deliberate.',
      "The look reads as Ant even after theming: tokens cover color, radius, and density, while shape and motion stay Ant's.",
      'React-only; Vue and Angular versions are separate community projects.',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    version: '@mantine/core 9.4.2',
    docs: 'https://mantine.dev',
    tagline:
      'A React library with a large hooks package and official form, date, and chart add-ons.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS Modules + CSS variables',
    license: 'MIT',
    pros: [
      '142 components and 82 hooks; forms, dates, charts, notifications, and rich text are official packages.',
      'No runtime CSS-in-JS: styling is CSS Modules with tokens exposed as CSS variables.',
      'Every component documents named Styles API selectors, and unstyled and headless modes are built in.',
      'Weekly patches and fast issue triage, with strong TypeScript docs.',
    ],
    cons: [
      'Current versions require React 19.2+; React 18 codebases stay on the v8 line.',
      'React-only.',
      'A full import of @mantine/core is ~155 KB gzipped, so tree-shaking matters.',
      'Nearly all development is one maintainer, active and sponsor-funded.',
    ],
  },
  {
    id: 'carbon',
    name: 'Carbon',
    version: '@carbon/react 1.112.0',
    docs: 'https://carbondesignsystem.com',
    tagline:
      "IBM's enterprise design system, with a first-party web-components package alongside React.",
    kind: 'Styled React (+ web components)',
    frameworks: 'React + Lit web components',
    frameworksNote: 'Angular, Vue, Svelte community',
    styling: 'Sass + CSS variables',
    license: 'Apache-2.0',
    pros: [
      'Publishes per-component accessibility test results, including manual screen-reader passes mapped to WCAG criteria.',
      'Hardened for data-dense enterprise UIs, with data-table and app-shell components most systems lack.',
      'React and Lit web components ship first-party on the same release cadence.',
      'Tokens are theme-scoped roles, so color retheming across the four built-in themes is a token-file change.',
    ],
    cons: [
      'Component styles require a Dart Sass build; the precompiled CSS covers tokens, grid, and type only.',
      'IBM Plex is a literal in the compiled type classes, so moving off it means recompiling from Sass or overriding dozens of classes.',
      'A large surface across many packages, with a learning curve to match.',
      'Angular, Vue, and Svelte implementations are community-maintained.',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Atlaskit)',
    short: 'Atlaskit',
    version: '@atlaskit/tokens 16.3.0',
    docs: 'https://atlassian.design',
    tagline:
      'The system behind Jira, Confluence, and Trello, published as many independently versioned @atlaskit packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    license: 'Apache-2.0 code, Atlassian-scoped terms',
    pros: [
      "Proven at scale in Atlassian's products, with tokens and Figma libraries in lockstep with the code.",
      'Build-time Compiled CSS-in-JS keeps the style runtime near zero.',
      'Deep patterns for collaboration UX, including the well-regarded pragmatic-drag-and-drop.',
      'WCAG 2.1 AA target with published conformance reports.',
    ],
    cons: [
      'Per-package versioning: keeping dozens of @atlaskit versions aligned is your job.',
      'Compiled CSS-in-JS needs its own Babel/SWC and style-extraction setup.',
      'The design-system terms scope use to products that integrate with Atlassian, and docs assume that context.',
      'React-only.',
    ],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    version: '@blueprintjs/core 6.17.2',
    docs: 'https://blueprintjs.com',
    tagline:
      "Palantir's React toolkit for complex, data-dense desktop web interfaces.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass-compiled CSS (bp6- classes)',
    license: 'Apache-2.0',
    pros: [
      'Purpose-built for dense desktop tools: a virtualized Table, the Omnibar command palette, and a dual-calendar date-range picker.',
      'Maintained by a Palantir team, in production there since 2016 with steady releases.',
      'Thorough docs and consistent keyboard behavior.',
    ],
    cons: [
      'Desktop-first by stated design; touch and mobile are out of scope.',
      'No runtime theming layer: restyling means recompiling Sass variables or overriding bp6- classes, and dark mode is a class toggle.',
      'React-only.',
    ],
  },
  {
    id: 'astryx',
    name: 'Astryx',
    version: '@astryxdesign/core 0.1.8',
    docs: 'https://astryx.atmeta.com',
    tagline:
      "Meta's design system: typed React components on StyleX, shipped as precompiled CSS, with first-party AI-agent tooling.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'StyleX (precompiled atomic CSS)',
    license: 'MIT',
    pros: [
      'Around 100 stable components, including an enterprise-grade Table and a WebGL-backed chart primitive.',
      'Ships precompiled CSS, so consumers need no StyleX build step; compiling from source is an opt-in for tree-shaking.',
      'The agent tooling is real: an MCP server, llms.txt, and a CLI that generates agent context files and can eject component source.',
      'Grown inside Meta before the June 2026 release, and shipping publicly every few days since.',
    ],
    cons: [
      "Custom brand tokens don't reach every component yet; independent testing found several fall back to Astryx defaults with nothing to patch.",
      'React-only, and requires React 19.',
      'Accessibility engineering is visible in releases, with no conformance statement or external audit yet.',
    ],
  },
  {
    id: 'gravity',
    name: 'Gravity UI',
    short: 'Gravity',
    version: '@gravity-ui/uikit 7.47.1',
    docs: 'https://gravity-ui.com',
    tagline:
      "Yandex's open-source React design system: a family of @gravity-ui packages with a Figma library and Storybook.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS (BEM classes) + CSS variables',
    license: 'MIT',
    pros: [
      'A broad core set plus scoped packages for dates, icons, charts, navigation, and a headless data table.',
      'Light, dark, and high-contrast themes built in, with CSS-variable theming and a hosted theme editor.',
      'A documented accessibility program: screen-reader audits drove keyboard and focus fixes across components.',
      'Supports React 16.14 through 19 in one release.',
    ],
    cons: [
      'React-only.',
      'Capabilities live in separate packages, so dates, charts, and the data table add dependencies.',
      "Little verified adoption outside Yandex's products so far.",
    ],
  },
  {
    id: 'radix',
    name: 'Radix UI',
    short: 'Radix',
    width: 'narrow',
    version: 'radix-ui 1.6.7',
    docs: 'https://www.radix-ui.com/primitives',
    tagline:
      'The reference unstyled React primitives: behavior and accessibility only, you bring the CSS.',
    kind: 'Headless React primitives',
    frameworks: 'React',
    styling: 'Unstyled; bring your own',
    license: 'MIT',
    pros: [
      'Interaction and accessibility behavior that other libraries treat as the reference.',
      'Style-agnostic, so it never fights your design.',
      'One radix-ui package with per-primitive imports and composition via asChild.',
      'The most widely deployed headless layer: years of shadcn projects run on it in production.',
    ],
    cons: [
      'No combobox, table, or date-picker primitives; those compose from Select, Popover, and third parties.',
      'React-only.',
      'shadcn/ui moved its default for new projects to Base UI in July 2026; Radix stays supported there.',
    ],
  },
  {
    id: 'baseui',
    name: 'Base UI',
    version: '@base-ui/react 1.6.0',
    docs: 'https://base-ui.com',
    tagline:
      'A second-generation unstyled React library from the people behind Radix, Floating UI, and MUI.',
    kind: 'Headless React primitives',
    frameworks: 'React',
    styling: 'Unstyled; bring your own',
    license: 'MIT',
    pros: [
      'Ships primitives Radix lacks: Combobox, Autocomplete, Number Field, Meter, and form Field/Fieldset.',
      "MUI's stated top investment, and Material UI v9 already builds new components on it.",
      'The default base for new shadcn/ui projects since July 2026.',
      'One package with a render-prop API in place of asChild.',
    ],
    cons: [
      'Newer than Radix (1.0 in December 2025), with fewer third-party examples and answers.',
      'React-only.',
    ],
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    short: 'shadcn',
    version: 'shadcn CLI 4.15.0',
    docs: 'https://ui.shadcn.com',
    tagline:
      'Tailwind-styled components copied into your repo by CLI, on your choice of Base UI, Radix, or React Aria.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    frameworksNote: 'Vue, Svelte community ports',
    styling: 'Tailwind + CSS variables',
    license: 'MIT',
    pros: [
      'Total ownership: the code lands in your repo, so there is no black-box dependency and no version lock.',
      'Accessibility rides on the primitive layer you pick: Base UI (the default), Radix, or React Aria.',
      'The default component shape of AI tools: v0, Cursor, and similar generate shadcn-style code.',
      'A large ecosystem of themes, blocks, and community registries.',
    ],
    cons: [
      'Tailwind is required; the generated code is utility classes throughout.',
      "No automatic upgrades: syncing upstream fixes is a manual diff, and harder once you've edited a component.",
      'Consistency across dozens of copied files is your problem, and community-registry quality varies.',
    ],
  },
  {
    id: 'untitledui',
    name: 'Untitled UI',
    short: 'Untitled',
    version: 'untitledui CLI 0.1.64',
    docs: 'https://www.untitledui.com/react',
    tagline:
      'A large copy-paste React + Tailwind collection built on React Aria, the code counterpart to the Untitled UI Figma kit.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    styling: 'Tailwind CSS + React Aria',
    license: 'MIT core + paid Pro tier',
    pros: [
      'A broad set on React Aria behavior, copied into your repo by CLI with no runtime dependency.',
      'Tailwind v4 styling with a synced Figma kit, so design and code stay close.',
      'The free tier is plain MIT and covers the base components; charts and toasts come wired to Recharts and Sonner.',
    ],
    cons: [
      'React-only, and requires React 19 and Tailwind CSS 4.',
      'Full page examples, extra icon styles, and the Figma kit sit in paid tiers ($349–$8,999).',
      'Copy-paste sprawl: consistency and upgrades across the copied files are your problem.',
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
  { id: 'accordion', label: 'Accordion', members: 'Collapse / expander / disclosure' },
  { id: 'table', label: 'Table', members: 'Table / data grid' },
  { id: 'tag', label: 'Tag / Badge', members: 'Tag, badge, chip, lozenge' },
  { id: 'progress', label: 'Progress', members: 'Bar, spinner, skeleton' },
  { id: 'avatar', label: 'Avatar', members: 'Avatar / avatar group' },
  { id: 'card', label: 'Card', members: 'Card / tile / surface' },
  { id: 'nav', label: 'Nav helpers', members: 'Breadcrumb, pagination, steps' },
  { id: 'icons', label: 'Icons', members: 'Bundled icon set' },
  { id: 'typography', label: 'Typography', members: 'Text / title components' },
  { id: 'charts', label: 'Charts', members: 'First-party data viz' },
]

/**
 * Coverage marks per system, keyed by category id. Absent keys default to
 * 'no'. Honest, grouped-by-job marks; see the module header. `partial` =
 * basic, simple, or community-only; `paid` = behind a commercial tier.
 * headless primitives (Radix, Base UI) get marks only where they ship an
 * actual primitive, so their empty cells reflect "you build the visual".
 */
export const COVERAGE: Record<string, Partial<Record<string, Mark>>> = {
  anta: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes', choice: 'partial',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes', dialog: 'yes',
    accordion: 'yes', table: 'partial', tag: 'yes', card: 'yes', progress: 'partial',
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
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes',
  },
  antd: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial',
  },
  mantine: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'partial', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'partial', typography: 'yes', charts: 'yes',
  },
  carbon: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'partial', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', card: 'yes', nav: 'yes',
    icons: 'yes', typography: 'partial', charts: 'yes',
  },
  atlassian: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', table: 'yes', tag: 'yes',
    progress: 'yes', avatar: 'yes', card: 'partial', nav: 'yes',
    icons: 'yes', typography: 'partial',
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
  radix: {
    button: 'partial', select: 'yes', combobox: 'no', choice: 'yes',
    slider: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes', dialog: 'yes',
    toast: 'yes', accordion: 'yes', progress: 'yes', avatar: 'yes',
    nav: 'partial', icons: 'yes',
  },
  baseui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes',
    dialog: 'yes', toast: 'yes', accordion: 'yes', progress: 'yes',
    avatar: 'yes', nav: 'partial',
  },
  shadcn: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'partial', charts: 'yes',
  },
  untitledui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'yes', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'partial',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'partial',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'yes',
  },
  gravity: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'partial',
    choice: 'yes', slider: 'yes', datetime: 'partial', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'partial',
  },
}

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
  radix: {
    button: 'https://www.radix-ui.com/primitives/docs/components/toggle',
    select: 'https://www.radix-ui.com/primitives/docs/components/select',
    choice: 'https://www.radix-ui.com/primitives/docs/components/checkbox',
    slider: 'https://www.radix-ui.com/primitives/docs/components/slider',
    tabs: 'https://www.radix-ui.com/primitives/docs/components/tabs',
    menu: 'https://www.radix-ui.com/primitives/docs/components/dropdown-menu',
    tooltip: 'https://www.radix-ui.com/primitives/docs/components/tooltip',
    dialog: 'https://www.radix-ui.com/primitives/docs/components/dialog',
    toast: 'https://www.radix-ui.com/primitives/docs/components/toast',
    accordion: 'https://www.radix-ui.com/primitives/docs/components/accordion',
    progress: 'https://www.radix-ui.com/primitives/docs/components/progress',
    avatar: 'https://www.radix-ui.com/primitives/docs/components/avatar',
    nav: 'https://www.radix-ui.com/primitives/docs/components/navigation-menu',
    icons: 'https://www.radix-ui.com/icons',
  },
  baseui: {
    button: 'https://base-ui.com/react/components/toggle-group',
    textinput: 'https://base-ui.com/react/components/input',
    select: 'https://base-ui.com/react/components/select',
    combobox: 'https://base-ui.com/react/components/combobox',
    choice: 'https://base-ui.com/react/components/checkbox',
    slider: 'https://base-ui.com/react/components/slider',
    tabs: 'https://base-ui.com/react/components/tabs',
    menu: 'https://base-ui.com/react/components/menu',
    tooltip: 'https://base-ui.com/react/components/tooltip',
    dialog: 'https://base-ui.com/react/components/dialog',
    toast: 'https://base-ui.com/react/components/toast',
    accordion: 'https://base-ui.com/react/components/accordion',
    progress: 'https://base-ui.com/react/components/progress',
    avatar: 'https://base-ui.com/react/components/avatar',
    nav: 'https://base-ui.com/react/components/navigation-menu',
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
    table: 'https://www.untitledui.com/react/components/tables',
    tag: 'https://www.untitledui.com/react/components/tags',
    progress: 'https://www.untitledui.com/react/components/progress-indicators',
    avatar: 'https://www.untitledui.com/react/components/avatars',
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
    nav: 'https://gravity-ui.com/components/uikit/breadcrumbs',
    icons: 'https://gravity-ui.com/components/uikit/icon',
    typography: 'https://gravity-ui.com/components/uikit/text',
  },
}

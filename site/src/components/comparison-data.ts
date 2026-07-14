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
    version: '@antadesign/anta 0.3.6',
    docs: 'https://anta.design',
    tagline:
      'Framework-agnostic web components with thin React/Preact wrappers, a tiny CSS-variable token set, and no style or animation runtime.',
    kind: 'Styled web components + JSX wrappers',
    frameworks: 'React/Preact wrappers of Web components',
    styling: 'Plain CSS + CSS-variable tokens',
    license: 'MIT',
    pros: [
      'Web components run in React, Preact, or plain HTML; the JSX wrappers are a thin, optional convenience.',
      'Declarative DOM: components never mutate their own host attributes, so they render correctly from a Worker thread or any reactive engine.',
      'No style runtime and no animation runtime ship to consumers. Styling is plain CSS in a single @layer that any consumer rule overrides.',
      'The token set is small: color roles for text, background, and border, plus fonts and one focus ring. Everything else is a per-component CSS variable.',
      'oklch color throughout, so tone tuning stays perceptually stable and dark mode falls out of the same tokens.',
      'Granular per-element imports keep bundles lean; the one animation dependency, Lottie, stays in the separate stickers package.',
    ],
    cons: [
      'Young and small: ~19 components, with no toast, slider, avatar, or data grid yet.',
      'One organization at an early version (0.x), so a smaller ecosystem, community, and track record than the incumbents.',
      'Table and Select stay intentionally simple, short of the data grid in enterprise kits.',
      'No first-party charts or form-management layer.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    short: 'WA',
    width: 'narrow',
    version: 'webawesome 3.10.0 (beta)',
    docs: 'https://webawesome.com',
    tagline:
      "Font Awesome's framework-agnostic web components and CSS framework, the commercial successor to Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Web components',
    frameworksNote: 'React, Vue, Angular, Svelte guides',
    styling: 'CSS framework + ::part() + CSS variables',
    license: 'MIT core + paid Pro tier',
    pros: [
      'Framework-agnostic web components that work in any stack or plain HTML.',
      'CSS-variable and ::part() theming, plus a utility and layout CSS framework.',
      'A broad component set and Font Awesome icon integration.',
      'Backed by an established company with commercial funding.',
    ],
    cons: [
      'Freemium: combobox, date/file inputs, toasts, charts, and video are paid Pro components.',
      'Still in beta, so API churn is a risk.',
      'Built on Lit, so it ships a runtime dependency and leans on shadow DOM (SSR/hydration and form-association caveats).',
      'Not oriented around Worker-thread or declarative-DOM rendering.',
    ],
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    short: 'Polaris',
    version: 'Web components 2026-01',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline:
      "Shopify's system for apps that must look native inside Shopify Admin, now shipped as CDN-delivered web components.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Web components',
    styling: 'Locked to the Shopify look',
    license: 'Restricted (Shopify apps only)',
    pros: [
      'Framework-agnostic web components, a rare modern first-party example.',
      'Zero-build CDN delivery, always up to date, small footprint.',
      'Pixel-consistent, native integration with Shopify surfaces.',
      'Built-in accessibility with developer warnings for missing a11y props.',
    ],
    cons: [
      'Restrictive license: usable mainly for apps that interoperate with Shopify, not a general-purpose kit.',
      "Not customizable by design, so you can't make it match your own brand.",
      "CDN “always latest” model, so components aren't version-pinned; only the types are.",
      'Narrow component set aimed at Shopify app UIs; still churning after the React→WC migration.',
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
    styling: 'CSS-in-JS (Emotion, moving to Pigment)',
    license: 'MIT core + paid MUI X',
    pros: [
      'A large component surface out of the box, plus MUI X for data grid, charts, and pickers.',
      'A large ecosystem, documentation, themes, and hiring pool.',
      'Batteries-included theming with a deep theme object.',
      'CSS-variable theming and color-mix() color, with Pigment CSS as the zero-runtime path.',
    ],
    cons: [
      'Heavy bundle and CSS-in-JS runtime cost; the Pigment migration exists to reduce it.',
      'The Material look is opinionated and hard to fully escape.',
      'The theme-override API has a steep learning curve; major-version migrations are frequent.',
      'React-only, and advanced components sit behind paid MUI X Pro/Premium.',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    short: 'Ant',
    width: 'narrow',
    version: 'antd 6.5.0',
    docs: 'https://ant.design',
    tagline:
      'An enterprise-class React library, strong for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React',
    frameworksNote: 'Angular, Vue community ports',
    styling: 'CSS-in-JS + CSS variables (v6)',
    license: 'MIT',
    pros: [
      'One of the largest component libraries, with heavy-duty Table, Form, Transfer, and Cascader.',
      'Strong for enterprise, admin, and data-heavy apps out of the box.',
      'A token/theme algorithm system with dark and compact modes.',
      'A mature ecosystem (Pro components, charts, large community) and first-class TypeScript.',
    ],
    cons: [
      'Accessibility is a weak point: no a11y docs, inconsistent keyboard and screen-reader support.',
      'Bundle-size concerns; the CSS-in-JS runtime historically added SSR overhead.',
      'The antd look is distinctive and harder to fully rebrand.',
      'React-only; other frameworks are separate community projects.',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    version: '@mantine/core 9.4.1',
    docs: 'https://mantine.dev',
    tagline:
      'A React library with a large hooks package and official form, date, and chart add-ons.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS Modules + CSS variables',
    license: 'MIT',
    pros: [
      'Broad coverage out of the box: forms, dates, charts, notifications, and rich text are all official.',
      'Strong TypeScript DX and documentation.',
      'CSS Modules and CSS variables for styling, with theming and built-in dark mode.',
      'The @mantine/hooks utility library is usable standalone.',
    ],
    cons: [
      'React-only, with no path to other frameworks or plain HTML.',
      'A larger footprint than minimal or headless libraries.',
      'A history of large breaking majors: v6→v7 rewrote styling, v9 forces React 19.2+.',
      'Not headless, so deep visual divergence can mean fighting the Styles API.',
    ],
  },
  {
    id: 'carbon',
    name: 'Carbon',
    version: '@carbon/react 1.110.0',
    docs: 'https://carbondesignsystem.com',
    tagline:
      "IBM's enterprise design system, with a first-party web-components package alongside React.",
    kind: 'Styled React (+ web components)',
    frameworks: 'React wrappers of web components',
    frameworksNote: 'Angular, Vue, Svelte community',
    styling: 'Sass + CSS variables',
    license: 'Apache-2.0',
    pros: [
      'Hardened for enterprise, with data-table and app-shell components most systems lack.',
      'A well-resourced accessibility program targeting WCAG 2.1 AA.',
      'A multi-framework story, including a first-party Lit web-components package.',
      'A token system with Figma parity.',
    ],
    cons: [
      'Heavy and strongly IBM-branded; retheming away from the IBM look takes work.',
      'The Sass build pipeline adds friction versus plain-CSS or CDN systems.',
      'A large surface area and monorepo package sprawl; steep learning curve.',
      'Non-React frameworks are community-maintained and lag on versions.',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Atlaskit)',
    short: 'Atlaskit',
    version: '@atlaskit/* tokens 13.0.4',
    docs: 'https://atlassian.design',
    tagline:
      'The system behind Jira, Confluence, and Trello, published as many independently versioned @atlaskit packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    license: 'Apache-2.0',
    pros: [
      "Proven at scale in Atlassian's products.",
      'A token and theming system with an elevation model and dark mode.',
      'Build-time Compiled CSS-in-JS keeps the style runtime near zero.',
      'Accessibility investment (WCAG 2.1 AA) and first-class TypeScript.',
    ],
    cons: [
      'React-only, with no web-component or multi-framework path.',
      'Per-package versioning creates dependency-alignment overhead.',
      'Strongly Atlassian-branded; docs assume an Atlassian context.',
      'Compiled CSS-in-JS needs a specific Babel/SWC build setup.',
    ],
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    version: '@blueprintjs/core 6.17.0',
    docs: 'https://blueprintjs.com',
    tagline:
      "Palantir's React toolkit for complex, data-dense desktop web interfaces.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass-compiled CSS (bp6- classes)',
    license: 'Apache-2.0',
    pros: [
      'Built for dense professional desktop apps: dashboards, tooling, and data grids.',
      'A high-performance virtualized Table and Select/Omnibar/date components.',
      'Battle-tested at Palantir scale, with deliberate releases.',
      'Thorough docs and consistent keyboard behavior.',
    ],
    cons: [
      'React-only and desktop-first, a weak fit for mobile or touch.',
      'The Palantir look is opinionated and heavier to restyle than token-first systems.',
      'Ships global-ish compiled CSS with bp6- prefixes.',
      'Some overlay/ARIA edge cases have historically needed workarounds.',
    ],
  },
  {
    id: 'astryx',
    name: 'Astryx',
    version: '@astryxdesign/core 0.1.4',
    docs: 'https://astryx.atmeta.com',
    tagline:
      "Meta's new, AI-fluent design system: precompiled CSS and typed React components built on StyleX.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'StyleX (precompiled atomic CSS)',
    license: 'MIT',
    pros: [
      'Backed by Meta, reportedly matured internally for years before open-sourcing.',
      'A large claimed component set with a token-level theming model and ready themes.',
      'StyleX scales CSS size well; consumers get precompiled CSS with no required build step.',
      'Designed to be agent/AI-operable via a CLI, a different angle.',
    ],
    cons: [
      'New and beta (0.1.x), so API stability and track record are unproven.',
      'React-only, with internals coupled to StyleX, a Meta-specific toolchain.',
      'Accessibility and component-count claims are largely self-reported so far.',
      'A small public footprint; longevity outside Meta is uncertain.',
    ],
  },
  {
    id: 'gravity',
    name: 'Gravity UI',
    short: 'Gravity',
    version: '@gravity-ui/uikit 7.44.2',
    docs: 'https://gravity-ui.com',
    tagline:
      "Yandex's open-source React design system: a family of @gravity-ui packages with light/dark theming, a Figma library, and Storybook.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass + CSS variables',
    license: 'MIT',
    pros: [
      'Open-sourced from Yandex and proven across its products, with a broad component set in @gravity-ui/uikit.',
      'A ThemeProvider with built-in light/dark themes, SCSS mixins, and CSS-variable theming.',
      'A first-party ecosystem of scoped packages: date components, ~740 icons, and charts.',
      'MIT-licensed, with a Figma library and Storybook alongside the docs.',
    ],
    cons: [
      'React-only, with no web-component or multi-framework path.',
      'Capabilities split across separate packages (dates, charts), so full coverage adds dependencies.',
      'The Sass build pipeline adds friction versus plain-CSS or CDN systems.',
      'A smaller, more Yandex-centric community and docs than the largest incumbents.',
    ],
  },
  {
    id: 'radix',
    name: 'Radix UI',
    short: 'Radix',
    width: 'narrow',
    version: 'radix-ui 1.6.2',
    docs: 'https://www.radix-ui.com/primitives',
    tagline:
      'The reference unstyled React primitives: behavior and accessibility only, you bring the CSS.',
    kind: 'Headless React primitives',
    frameworks: 'React',
    styling: 'Unstyled; bring your own',
    license: 'MIT',
    pros: [
      'Accessibility and interaction behavior that other libraries treat as the reference.',
      'Style-agnostic, so it never fights your design.',
      'Granular per-primitive installs and composition (asChild, data-* state).',
      'The foundation under shadcn and many other design systems.',
    ],
    cons: [
      'Ships no visuals, so there is styling work before anything looks usable.',
      'React-only.',
      'A smaller component set than batteries-included libraries (no table, limited pickers).',
      'The Primitives-vs-Themes split can confuse newcomers.',
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
      'Headless accessibility from the people who wrote Radix and Floating UI, with cleaner APIs.',
      'More built-in components than early Radix (Combobox, Autocomplete, Number Field).',
      'MUI backing with a stated long-term maintenance commitment.',
      'Tree-shaking with no CSS baggage.',
    ],
    cons: [
      'Young: 1.0 landed February 2026, so a smaller track record and ecosystem.',
      'React-only.',
      'Unstyled, so you build all the visuals, the same cost as Radix.',
      'A 1.0 package rename (@base-ui-components/react → @base-ui/react) is a live migration papercut.',
    ],
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    short: 'shadcn',
    version: 'shadcn CLI 4.13.0',
    docs: 'https://ui.shadcn.com',
    tagline:
      'A copy-paste collection of Tailwind-styled components you own in your repo, added by CLI rather than installed as a dependency.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    frameworksNote: 'Vue, Svelte community ports',
    styling: 'Tailwind + CSS variables',
    license: 'MIT',
    pros: [
      'Total ownership: no black-box dependency, edit anything.',
      'A CLI-driven workflow that rides Radix/Base UI accessibility for free.',
      'Momentum and ecosystem (themes, blocks, community registries).',
      'No version-lock upgrade treadmill for the component code.',
    ],
    cons: [
      'Hard requirement on Tailwind, so not usable as-is without it.',
      'No automatic upgrades; you re-sync manually when upstream improves.',
      'Code sprawl: dozens of files copied into your repo, and consistency is your problem.',
      'Not a portable dependency you can pin and share; React-first.',
    ],
  },
  {
    id: 'untitledui',
    name: 'Untitled UI',
    short: 'Untitled',
    version: 'untitledui CLI 0.1.64',
    docs: 'https://www.untitledui.com/react',
    tagline:
      'A large copy-paste React + Tailwind component collection built on React Aria, the code counterpart to the Untitled UI Figma kit.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    styling: 'Tailwind CSS + React Aria',
    license: 'MIT core + paid Pro tier',
    pros: [
      'A broad component set on React Aria behavior and accessibility, added by CLI into your repo so you own the code with no runtime dependency.',
      'Tailwind v4 styling with a synced Figma kit, so design and code stay close.',
      'The free tier is genuinely MIT and covers most base components; charts (Recharts) and toasts (Sonner) come wired.',
      'No version-lock upgrade treadmill for the copied component code.',
    ],
    cons: [
      'Requires Tailwind and React 19, so not usable as-is without them.',
      'React-only, with no web-component or multi-framework path.',
      'The full page/app examples, extra icon styles, and Figma kit sit behind paid Pro tiers ($349–$8,999).',
      'Copy-paste sprawl: components land in your repo and consistency plus upgrades are your problem.',
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
    accordion: 'yes', table: 'partial', tag: 'yes', progress: 'partial',
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
    nav: 'yes', icons: 'yes', typography: 'yes',
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

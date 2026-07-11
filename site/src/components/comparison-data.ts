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
  /** Accessibility reputation, short. */
  a11y: string
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
    version: '@antadesign/anta 0.3.3',
    docs: 'https://anta.design',
    tagline:
      'Framework-agnostic web components with thin React/Preact wrappers, a tiny CSS-variable token set, and no style or animation runtime.',
    kind: 'Styled web components + JSX wrappers',
    frameworks: 'React/Preact wrappers of Web components',
    styling: 'Plain CSS + CSS-variable tokens (oklch)',
    a11y: 'ARIA layered in wrappers; solid',
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
      'Young and small: ~17 components, with no modal, toast, slider, combobox, avatar, or data grid yet.',
      'One organization at an early version (0.x), so a smaller ecosystem, community, and track record than the incumbents.',
      'Table and Select stay intentionally simple, short of the data grid or async combobox in enterprise kits.',
      'No first-party charts or form-management layer.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    version: 'webawesome 3.10.0 (beta)',
    docs: 'https://webawesome.com',
    tagline:
      "Font Awesome's framework-agnostic web components and CSS framework, the commercial successor to Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Web components',
    frameworksNote: 'React, Vue, Angular, Svelte guides',
    styling: 'CSS framework + ::part() + CSS variables',
    a11y: 'Good (inherited from Shoelace)',
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
    version: 'Web components 2026-01',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline:
      "Shopify's system for apps that must look native inside Shopify Admin, now shipped as CDN-delivered web components.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Web components',
    styling: 'Locked to the Shopify look',
    a11y: 'Strong; dev-time a11y warnings',
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
    version: '@mui/material 9.2.0',
    docs: 'https://mui.com/material-ui/',
    tagline:
      "The dominant React implementation of Google's Material Design, with a deep theming system.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS-in-JS (Emotion, moving to Pigment)',
    a11y: 'Mature, generally strong',
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
    version: 'antd 6.5.0',
    docs: 'https://ant.design',
    tagline:
      'An enterprise-class React library, strong for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React',
    frameworksNote: 'Angular, Vue community ports',
    styling: 'CSS-in-JS + CSS variables (v6)',
    a11y: 'Weak; no a11y docs',
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
    a11y: 'Good (varies by component)',
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
    a11y: 'Strong (IBM Equal Access program)',
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
    version: '@atlaskit/* tokens 13.0.4',
    docs: 'https://atlassian.design',
    tagline:
      'The system behind Jira, Confluence, and Trello, published as many independently versioned @atlaskit packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    a11y: 'Strong (WCAG 2.1 AA)',
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
    a11y: 'Good for desktop/keyboard',
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
    version: '@astryxdesign/core 0.1.4 (beta)',
    docs: 'https://astryx.atmeta.com',
    tagline:
      "Meta's new, AI-fluent design system: precompiled CSS and typed React components built on StyleX.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'StyleX (precompiled atomic CSS)',
    a11y: 'Claimed accessible (unaudited)',
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
    id: 'radix',
    name: 'Radix UI',
    version: 'radix-ui 1.6.2',
    docs: 'https://www.radix-ui.com/primitives',
    tagline:
      'The reference unstyled React primitives: behavior and accessibility only, you bring the CSS.',
    kind: 'Headless React primitives',
    frameworks: 'React',
    styling: 'Unstyled; bring your own',
    a11y: 'Reference-grade (WAI-ARIA APG)',
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
    a11y: 'Reference-grade (WAI-ARIA APG)',
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
    version: 'shadcn CLI 4.13.0',
    docs: 'https://ui.shadcn.com',
    tagline:
      'A copy-paste collection of Tailwind-styled components you own in your repo, added by CLI rather than installed as a dependency.',
    kind: 'Copy-paste React source',
    frameworks: 'React',
    frameworksNote: 'Vue, Svelte community ports',
    styling: 'Tailwind + CSS variables (oklch)',
    a11y: 'Inherits Radix / Base UI',
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
    button: 'yes', textinput: 'yes', select: 'yes', choice: 'partial',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes',
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
    select: 'yes', combobox: 'no', choice: 'yes', slider: 'yes', tabs: 'yes',
    menu: 'yes', tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    progress: 'yes', avatar: 'yes', nav: 'partial',
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
}

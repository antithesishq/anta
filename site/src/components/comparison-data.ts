/**
 * Data behind the /comparison page. One source of truth for the two
 * matrices (at-a-glance + component coverage) and the per-system pros/cons
 * cards, so the numbers can't drift between sections.
 *
 * Versions are a snapshot verified against npm / official docs in July 2026
 * (see `AS_OF`). They date quickly — re-check before quoting them elsewhere.
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
  /** True for Anta — drives the highlight styling in both matrices. */
  anta?: boolean
  /** Package + version string, e.g. "@mui/material 9.2.0". */
  version: string
  /** Canonical docs URL. */
  docs: string
  /** One-line identity. */
  tagline: string
  /** Distribution / shape, e.g. "Styled web components + JSX wrappers". */
  kind: string
  /** Which frameworks it targets. */
  frameworks: string
  /** Styling mechanism. */
  styling: string
  /** Dark-mode story, short. */
  dark: string
  /** Accessibility reputation, short. */
  a11y: string
  /** License, short. */
  license: string
  pros: string[]
  cons: string[]
}

/** Anta first (highlighted), then the framework-agnostic web-component peers,
 *  the batteries-included React libraries, the headless React primitives, and
 *  the copy-paste model — roughly grouped by how close they sit to Anta. */
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
    frameworks: 'Any — React, Preact, plain HTML',
    styling: 'Plain CSS + CSS-variable tokens (oklch)',
    dark: '.dark ancestor class',
    a11y: 'ARIA layered in wrappers; solid',
    license: 'MIT',
    pros: [
      'Framework-agnostic web components run in React, Preact, or plain HTML — the JSX wrappers are a thin, optional convenience.',
      'Declarative DOM: components never mutate their own host attributes, so they render correctly from a Worker thread or any reactive engine.',
      'No style runtime and no animation runtime ship to consumers — styling is plain CSS in a single @layer, trivially overridable.',
      'Deliberately tiny token vocabulary (color roles for text / background / border, plus fonts and one focus ring); everything else is a per-component CSS variable.',
      'oklch color model throughout, so tone tuning stays perceptually stable and dark mode falls out of the same tokens.',
      'Granular per-element imports keep bundles lean; the only animation dependency (Lottie) is isolated in the separate stickers package.',
    ],
    cons: [
      'Young and small: ~17 components, no modal/dialog, toast, slider, combobox, avatar, or data grid yet.',
      'One organization, early version (0.x) — smaller ecosystem, community, and real-world track record than the incumbents.',
      'Table and Select are intentionally simple, not the rich data-grid / async-combobox found in enterprise kits.',
      'No first-party charts or form-management layer.',
    ],
  },
  {
    id: 'webawesome',
    name: 'Web Awesome',
    version: 'webawesome 3.10.0 (beta)',
    docs: 'https://webawesome.com',
    tagline:
      "Font Awesome's framework-agnostic web components and CSS framework — the commercial successor to Shoelace.",
    kind: 'Styled web components',
    frameworks: 'Any — web components (React/Vue/Angular/Svelte guides)',
    styling: 'CSS framework + ::part() + CSS variables',
    dark: 'Built-in light/dark themes',
    a11y: 'Good (inherited from Shoelace)',
    license: 'MIT core + paid Pro tier',
    pros: [
      'True framework-agnostic web components that work in any stack or plain HTML.',
      'Rich CSS-variable + ::part() theming plus a full utility/layout CSS framework.',
      'Very broad component set and excellent Font Awesome icon integration.',
      'Backed by an established company with commercial funding.',
    ],
    cons: [
      'Freemium — combobox, date/file inputs, toasts, charts, and video are paid Pro components.',
      'Still in beta, so API churn is a real risk.',
      'Built on Lit, so it ships a runtime dependency and leans heavily on shadow DOM (SSR/hydration and form-association caveats).',
      'Not oriented around Worker-thread / declarative-DOM rendering.',
    ],
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    version: 'Polaris web components 2026-01',
    docs: 'https://shopify.dev/docs/api/app-home/web-components',
    tagline:
      "Shopify's system for apps that must look native inside Shopify Admin, now shipped as CDN-delivered web components.",
    kind: 'Styled web components (CDN)',
    frameworks: 'Any — web components',
    styling: 'Locked to the Shopify look',
    dark: 'Automatic (adopts host surface)',
    a11y: 'Strong; dev-time a11y warnings',
    license: 'Restricted (Shopify apps only)',
    pros: [
      'Genuinely framework-agnostic web components — a rare modern first-party example.',
      'Zero-build CDN delivery, always up to date, small footprint.',
      'Pixel-consistent, native integration with Shopify surfaces.',
      'Solid built-in accessibility with helpful developer warnings.',
    ],
    cons: [
      'Restrictive license: effectively only for building apps that interoperate with Shopify, not a general-purpose kit.',
      'Deliberately not customizable — you cannot make it match your own brand.',
      "CDN “always latest” model means components aren't version-pinned (only the types are).",
      'Narrow component set aimed at Shopify app UIs; still churning post React→WC migration.',
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
    dark: 'Color schemes / palette.mode',
    a11y: 'Mature, generally strong',
    license: 'MIT core + paid MUI X',
    pros: [
      'Huge component surface out of the box, plus MUI X for the hard ones (data grid, charts, pickers).',
      'Enormous ecosystem, documentation, themes, and hiring pool.',
      'Batteries-included theming with a deep, opinionated theme object.',
      'v9 is moving to CSS variables + color-mix() and a Tailwind/Pigment path.',
    ],
    cons: [
      'Heavy bundle and CSS-in-JS runtime cost (the whole Pigment migration exists to fix this).',
      'Strongly opinionated Material look is hard to fully escape.',
      'The theme-override API has a steep learning curve; major-version migrations are frequent.',
      'React-only, and advanced components are paywalled behind MUI X Pro/Premium.',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    version: 'antd 6.5.0',
    docs: 'https://ant.design',
    tagline:
      'An enterprise-class React library, especially strong for data-dense admin and dashboard UIs.',
    kind: 'Styled React components',
    frameworks: 'React (Angular/Vue community ports)',
    styling: 'CSS-in-JS + CSS variables (v6)',
    dark: 'darkAlgorithm token preset',
    a11y: 'Weak — no a11y docs',
    license: 'MIT',
    pros: [
      'One of the richest component libraries anywhere, with heavy-duty Table, Form, Transfer, and Cascader.',
      'Excellent for enterprise/admin/data-heavy apps out of the box.',
      'Powerful token/theme algorithm system with easy dark and compact modes.',
      'Mature ecosystem (Pro components, charts, huge community) and first-class TypeScript.',
    ],
    cons: [
      'Accessibility is a real weakness — no a11y docs, inconsistent keyboard and screen-reader support.',
      'Bundle-size concerns; CSS-in-JS runtime historically added SSR overhead.',
      'Strong, distinctive "antd look" is harder to fully rebrand.',
      'React-only; other frameworks are separate community projects.',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    version: '@mantine/core 9.4.1',
    docs: 'https://mantine.dev',
    tagline:
      'A full-featured React library with a large hooks package and official form/date/chart add-ons.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'CSS Modules + CSS variables',
    dark: 'Built-in light/dark/auto',
    a11y: 'Good (varies by component)',
    license: 'MIT',
    pros: [
      'Very broad coverage out of the box — forms, dates, charts, notifications, rich text all official.',
      'Excellent TypeScript DX and documentation.',
      'Modern styling (CSS Modules + CSS variables) with strong theming and built-in dark mode.',
      'Extensive @mantine/hooks utility library usable standalone.',
    ],
    cons: [
      'React-only — no path to other frameworks or plain HTML.',
      'Larger footprint than minimal or headless libraries.',
      'A history of large breaking majors (v6→v7 rewrote styling; v9 forces React 19.2+).',
      'Not headless — deep visual divergence can mean fighting the Styles API.',
    ],
  },
  {
    id: 'carbon',
    name: 'Carbon',
    version: '@carbon/react 1.110.0',
    docs: 'https://carbondesignsystem.com',
    tagline:
      "IBM's enterprise-grade design system, with a first-party web-components package alongside React.",
    kind: 'Styled React (+ web components)',
    frameworks: 'React, web components; Angular/Vue/Svelte (community)',
    styling: 'Sass + CSS variables',
    dark: 'Four built-in themes',
    a11y: 'Strong (IBM Equal Access program)',
    license: 'Apache-2.0',
    pros: [
      'Enterprise-hardened, with deep data-table and app-shell components most systems lack.',
      'Serious, well-resourced accessibility program (WCAG 2.1 AA).',
      'Real multi-framework story, including a first-party Lit web-components package.',
      'Comprehensive token system and Figma parity.',
    ],
    cons: [
      'Heavy and strongly IBM-branded; retheming away from the "IBM look" is nontrivial.',
      'Sass build pipeline adds friction versus plain-CSS/CDN systems.',
      'Large surface area and monorepo package sprawl; steep learning curve.',
      'Non-React frameworks are community-maintained and version-lagging.',
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Atlaskit)',
    version: '@atlaskit/* — tokens 13.0.4',
    docs: 'https://atlassian.design',
    tagline:
      'The system behind Jira, Confluence, and Trello, published as many independently versioned @atlaskit packages.',
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Compiled CSS-in-JS + tokens',
    dark: 'Token themes (light/dark)',
    a11y: 'Strong (WCAG 2.1 AA)',
    license: 'Apache-2.0',
    pros: [
      "Proven at massive scale in Atlassian's flagship products.",
      'Mature token + theming system with a distinctive elevation model and solid dark mode.',
      'Build-time Compiled CSS-in-JS gives near-zero style runtime.',
      'Serious accessibility investment and first-class TypeScript.',
    ],
    cons: [
      'React-only — no web-component or multi-framework path.',
      'Per-package versioning creates real dependency-alignment overhead.',
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
      "Palantir's React toolkit optimized for complex, data-dense desktop web interfaces.",
    kind: 'Styled React components',
    frameworks: 'React',
    styling: 'Sass-compiled CSS (bp6- classes)',
    dark: '.bp6-dark container class',
    a11y: 'Good for desktop/keyboard',
    license: 'Apache-2.0',
    pros: [
      'Best-in-class for dense professional desktop apps — dashboards, tooling, data grids.',
      'Strong, high-performance virtualized Table and rich Select/Omnibar/date components.',
      'Battle-tested at Palantir scale; stable, deliberate releases.',
      'Thorough docs and consistent keyboard behavior.',
    ],
    cons: [
      'React-only and explicitly desktop-first — weak fit for mobile/touch.',
      'Opinionated Palantir look; heavier to restyle than token-first systems.',
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
    dark: 'Installable theme packages',
    a11y: 'Claimed accessible (unaudited)',
    license: 'MIT',
    pros: [
      'Backed by Meta; reportedly matured internally for years before open-sourcing.',
      'Very large claimed component set with a coherent token-level theming model and ready themes.',
      'StyleX scales CSS size well; consumers get precompiled CSS with no required build step.',
      'Explicitly designed to be agent/AI-operable via a CLI — a genuinely different angle.',
    ],
    cons: [
      'Very new and beta (0.1.x) — API stability and real-world track record are unproven.',
      'React-only, with internals coupled to StyleX (a Meta-specific toolchain).',
      'Accessibility and component-count claims are largely self-reported so far.',
      'Small public footprint; longevity outside Meta is uncertain.',
    ],
  },
  {
    id: 'radix',
    name: 'Radix UI',
    version: 'radix-ui 1.6.2',
    docs: 'https://www.radix-ui.com/primitives',
    tagline:
      'The reference-quality unstyled React primitives — behavior and accessibility only, you bring the CSS.',
    kind: 'Headless React primitives',
    frameworks: 'React',
    styling: 'Unstyled — bring your own',
    dark: 'Bring your own (Themes adds one)',
    a11y: 'Reference-grade (WAI-ARIA APG)',
    license: 'MIT',
    pros: [
      'Best-in-class accessibility and interaction behavior — the de-facto reference.',
      'Completely style-agnostic; never fights your design.',
      'Granular per-primitive installs and excellent composition (asChild, data-* state).',
      'The foundation under shadcn and countless design systems.',
    ],
    cons: [
      'Ships zero visuals — significant styling work before anything looks usable.',
      'React-only.',
      'Smaller component set than batteries-included libraries (no table, limited pickers).',
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
    styling: 'Unstyled — bring your own',
    dark: 'Bring your own',
    a11y: 'Reference-grade (WAI-ARIA APG)',
    license: 'MIT',
    pros: [
      'Headless accessibility from the people who wrote Radix and Floating UI, with cleaner APIs.',
      'Richer built-in components than early Radix (Combobox, Autocomplete, Number Field).',
      'Strong MUI backing with a stated long-term maintenance commitment.',
      'Excellent tree-shaking, no CSS baggage.',
    ],
    cons: [
      'Very young — 1.0 landed February 2026, so a smaller track record and ecosystem.',
      'React-only.',
      'Unstyled: you build all the visuals, same cost as Radix.',
      'A 1.0 package rename (@base-ui-components/react → @base-ui/react) is a live migration papercut.',
    ],
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    version: 'shadcn CLI 4.13.0',
    docs: 'https://ui.shadcn.com',
    tagline:
      'Not an installed library but a copy-paste collection of Tailwind-styled components you own in your own repo.',
    kind: 'Copy-paste React source',
    frameworks: 'React (Vue/Svelte community ports)',
    styling: 'Tailwind + CSS variables (oklch)',
    dark: '.dark class (next-themes)',
    a11y: 'Inherits Radix / Base UI',
    license: 'MIT',
    pros: [
      'Total ownership — no black-box dependency, edit anything.',
      'Excellent CLI and DX; rides Radix/Base UI accessibility for free.',
      'Huge momentum and ecosystem (themes, blocks, community registries).',
      'No version-lock upgrade treadmill for the component code.',
    ],
    cons: [
      'Hard requirement on Tailwind — not usable as-is without it.',
      'No automatic upgrades; you manually re-sync when upstream improves.',
      'Code sprawl — dozens of files copied into your repo, consistency is your problem.',
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
  { id: 'motion', label: 'Animated art', members: 'Stickers / illustrations' },
]

/**
 * Coverage marks per system, keyed by category id. Absent keys default to
 * 'no'. Honest, grouped-by-job marks — see the module header. `partial` =
 * basic, simple, or community-only; `paid` = behind a commercial tier.
 * headless primitives (Radix, Base UI) get marks only where they ship an
 * actual primitive, so their empty cells reflect "you build the visual".
 */
export const COVERAGE: Record<string, Partial<Record<string, Mark>>> = {
  anta: {
    button: 'yes', textinput: 'yes', select: 'yes', choice: 'partial',
    datetime: 'yes', tabs: 'yes', menu: 'yes', tooltip: 'yes',
    accordion: 'yes', table: 'partial', tag: 'yes', progress: 'partial',
    icons: 'yes', typography: 'yes', motion: 'yes',
  },
  webawesome: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'paid',
    choice: 'yes', slider: 'yes', datetime: 'paid', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'paid', accordion: 'yes',
    tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes', nav: 'partial',
    icons: 'yes', typography: 'partial', charts: 'paid', motion: 'partial',
  },
  polaris: {
    button: 'yes', textinput: 'yes', select: 'yes', choice: 'yes',
    datetime: 'yes', menu: 'yes', tooltip: 'yes', dialog: 'partial',
    toast: 'partial', table: 'yes', tag: 'yes', progress: 'partial',
    avatar: 'yes', card: 'yes', icons: 'yes', typography: 'yes',
  },
  mui: {
    button: 'yes', textinput: 'yes', select: 'yes', combobox: 'yes',
    choice: 'yes', slider: 'yes', datetime: 'paid', tabs: 'yes', menu: 'yes',
    tooltip: 'yes', dialog: 'yes', toast: 'yes', accordion: 'yes',
    table: 'yes', tag: 'yes', progress: 'yes', avatar: 'yes', card: 'yes',
    nav: 'yes', icons: 'yes', typography: 'yes', charts: 'paid',
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

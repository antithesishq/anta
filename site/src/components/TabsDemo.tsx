import { useEffect } from 'preact/hooks'
import { Tabs, TabPanel, Tag } from '@antadesign/anta'

/**
 * Live demo islands for the Tabs docs page.
 *
 * `<Tabs>` renders its strip from the `options` array and never reads its children;
 * panels are self-managing `<TabPanel>` (`<a-tabpanel>`) elements that show/hide
 * themselves off-DOM. So there's no child introspection — the demos would render in
 * static MDX too — but panels still need the elements registered to resolve, so each
 * example stays a `client:only="preact"` island (registered by DocsLayout's client
 * `<script>`; the `useEffect` import is belt-and-suspenders for hydration timing).
 */
function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const col = { display: 'flex', flexDirection: 'column' as const, gap: '20px', alignItems: 'flex-start' as const }

// Fixed panel box so switching tabs doesn't reflow the preview (panels differ in length):
// a stable min-height, and width:100% so the panel fills the strip's width every time.
const panel = { margin: 0, paddingTop: '4px', minHeight: '48px', width: '100%', boxSizing: 'border-box' as const }

/** Core API: a strip (from `options`) with panels that switch. */
export function Basic() {
  useElements()
  // The strip and panels are flat siblings; laying them out is the consumer's job. Here
  // a flex column gaps them and centres the strip (`alignSelf` on the strip, since a
  // `<Tabs>` `style` lands on `<a-tabs>`) while the panels stay full width.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <Tabs
        defaultValue="account"
        label="Settings"
        style={{ alignSelf: 'center' }}
        options={[
          { value: 'account', label: 'Account', icon: 'home' },
          { value: 'security', label: 'Security' },
          { value: 'billing', label: 'Billing' },
        ]}
      >
        <TabPanel value="account" style={panel}><p style={{ margin: 0 }}>Profile, email, and password.</p></TabPanel>
        <TabPanel value="security" style={panel}><p style={{ margin: 0 }}>Two-factor auth and active sessions.</p></TabPanel>
        <TabPanel value="billing" style={panel}><p style={{ margin: 0 }}>Plan, invoices, and payment method.</p></TabPanel>
      </Tabs>
    </div>
  )
}

const triad = [
  { value: 'a', label: 'Overview' },
  { value: 'b', label: 'Activity' },
  { value: 'c', label: 'Settings' },
]

export function Priorities() {
  useElements()
  return (
    <div style={col}>
      <Tabs defaultValue="a" priority="primary" options={triad} />
      <Tabs defaultValue="a" priority="secondary" options={triad} />
      <Tabs defaultValue="a" priority="tertiary" options={triad} />
    </div>
  )
}

// All named tones except neutral, plus a one-off custom colour as the last row.
const TONE_ROWS = ['brand', 'info', 'success', 'warning', 'critical', '#0d9488'] as const

/** One column of the Tones matrix: every tone at a single priority (2 tabs each). */
export function TonesColumn({ priority }: { priority?: 'primary' | 'secondary' | 'tertiary' }) {
  useElements()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
      {TONE_ROWS.map((tone) => (
        <Tabs
          key={tone}
          defaultValue="a"
          priority={priority}
          tone={tone}
          style={{ alignSelf: 'center' }}
          options={triad}
        />
      ))}
    </div>
  )
}

/** Per-tab tone: a neutral strip where individual tabs override the tone (success /
 *  warning / critical), colouring their label + icon and — when active — their indicator. */
export function PerTabTone() {
  useElements()
  return (
    <Tabs
      defaultValue="overview"
      label="Review queue"
      options={[
        { value: 'overview', label: 'Overview' },
        { value: 'approved', label: 'Approved', icon: 'circle-check', tone: 'success' },
        { value: 'flagged', label: 'Flagged', tone: 'warning' },
        { value: 'rejected', label: 'Rejected', tone: 'critical' },
      ]}
    />
  )
}

export function Sizes() {
  useElements()
  const row = [
    { value: 'a', label: 'One' },
    { value: 'b', label: 'Two' },
    { value: 'c', label: 'Three' },
  ]
  return (
    <div style={col}>
      <Tabs defaultValue="a" size="small" options={row} />
      <Tabs defaultValue="a" size="medium" options={row} />
      <Tabs defaultValue="a" size="large" options={row} />
    </div>
  )
}

/** One vertical strip at a given priority (Orientation matrix column). */
export function VerticalStrip({ priority }: { priority?: 'primary' | 'secondary' | 'tertiary' }) {
  useElements()
  return (
    <Tabs
      defaultValue="general"
      orientation="vertical"
      priority={priority}
      label="Workspace"
      options={[
        { value: 'general', label: 'General' },
        { value: 'members', label: 'Members' },
        { value: 'integrations', label: 'Integrations' },
      ]}
    />
  )
}

/** Tab content via `options` `children`: a leading icon, an arbitrary child (a counter
 *  Tag), and a trailing icon used as a status dot — the editor "unsaved changes" pattern. */
export function IconsContent() {
  useElements()
  return (
    <Tabs
      defaultValue="app"
      label="Open files"
      options={[
        { value: 'app', icon: 'braces', children: <>app.tsx <Tag size="small" value="2" /></> },
        { value: 'readme', label: 'README.md', icon: 'file' },
        { value: 'styles', icon: 'file', iconTrailing: 'circle-small-solid', children: 'styles.css' },
      ]}
    />
  )
}

const OVERFLOW_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'repositories', label: 'Repositories' },
  { value: 'pulls', label: 'Pull requests' },
  { value: 'discussions', label: 'Discussions' },
  { value: 'members', label: 'Members' },
  { value: 'integrations', label: 'Integrations' },
] as const

/** Default overflow: a strip wider than its container ellipsizes the labels. Each tab
 *  sets a `tooltip` (a truncatedOnly Tooltip the component anchors to the tab), so
 *  hovering a clipped tab reveals its full label. */
export function Overflow() {
  useElements()
  return (
    <div style={{ width: '100%', padding: '0 6px', boxSizing: 'border-box' }}>
      <Tabs
        defaultValue="overview"
        label="Sections"
        options={OVERFLOW_TABS.map(({ value, label }) => ({ value, label, tooltip: label }))}
      />
    </div>
  )
}

const SECTION_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'settings', label: 'Settings' },
  { value: 'members', label: 'Members' },
  { value: 'billing', label: 'Billing' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'audit', label: 'Audit log' },
]

/** Styling: opt back into horizontal scrolling (full labels, scrollbar). */
export function ScrollTabs() {
  useElements()
  return (
    <div className="scroll-tabs" style={{ maxWidth: '300px' }}>
      <Tabs defaultValue="overview" label="Sections" options={SECTION_TABS} />
    </div>
  )
}

/** Styling: equal-width tabs that fill the strip (varying label lengths → same width). */
export function EqualWidth() {
  useElements()
  return (
    <div className="equal-tabs" style={{ width: '100%' }}>
      <Tabs
        defaultValue="all"
        label="Filter"
        options={[
          { value: 'all', label: 'All' },
          { value: 'assigned', label: 'Assigned to me' },
          { value: 'recent', label: 'Recent' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
    </div>
  )
}

/** Styling: let labels wrap so the tabs grow taller instead of truncating. */
export function WrapTabs() {
  useElements()
  return (
    <div className="wrap-tabs" style={{ maxWidth: '300px' }}>
      <Tabs
        defaultValue="a"
        label="Reports"
        options={[
          { value: 'a', label: 'Quarterly revenue' },
          { value: 'b', label: 'Customer retention' },
          { value: 'c', label: 'Product analytics' },
        ]}
      />
    </div>
  )
}

/** Styling: a roomier primary track via plain CSS — `padding` + a matching `border-radius`
 *  (kept concentric). Two gaps shown: 1px and 3px. */
export function RoomyTabs() {
  useElements()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <Tabs className="roomy-1" defaultValue="a" label="Sections, 1px gap" options={triad} />
      <Tabs className="roomy-3" defaultValue="a" label="Sections, 3px gap" options={triad} />
    </div>
  )
}

/** Styling: squarer primary track + pill, heavier label, roomier track. */
export function SquareTabs() {
  useElements()
  return <Tabs className="square-tabs" defaultValue="a" label="Sections" options={triad} />
}

/** Styling: a tertiary strip whose sliding underline is recoloured, thinned to 1px, and
 *  given a glowing box-shadow — the glow rides the `::before` slider, so it slides with the
 *  line (no noslide). */
export function TertiaryGlow() {
  useElements()
  return <Tabs className="glow-tabs" priority="tertiary" defaultValue="a" label="Sections" options={triad} />
}

/** A fully-rounded "pill" primary strip via the built-in `round` attribute (track, tabs,
 *  and the sliding pill all go to 999px in one flag); `.pill-tabs a-tab` adds extra block
 *  padding for a taller capsule. */
export function PillTabs() {
  useElements()
  return <Tabs className="pill-tabs" round defaultValue="a" label="Sections" options={triad} />
}

/** Styling: noslide — the highlight snaps between tabs instead of sliding. */
export function NoSlide() {
  useElements()
  return <Tabs defaultValue="a" noslide label="Sections" options={triad} />
}

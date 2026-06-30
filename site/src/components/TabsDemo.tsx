import { useEffect } from 'preact/hooks'
import { Tabs, Tab, TabPanel, Tooltip, Tag } from '@antadesign/anta'

/**
 * Live demo islands for the Tabs docs page.
 *
 * Tabs is a **compound** component — `<Tabs>` reads its `<Tab>` / `<TabPanel>`
 * children to split the strip from the panels and wire up ARIA + roving tabindex.
 * That introspection runs in real React/Preact (a consuming app, the Playground
 * iframe, and a hydrated island) but NOT in Astro's static MDX, where slot children
 * arrive opaque. So each example here is a self-contained island, embedded in the
 * MDX with `client:only="preact"`, rather than inline `<Preview>` markup.
 *
 * Elements are registered by DocsLayout's client `<script>`; the `useEffect` import
 * is belt-and-suspenders for hydration timing (matches the SSR-caveat guidance).
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
// `fill` makes the Tabs container span the preview so the panel region has a stable width
// (otherwise it hugs the active panel's content and the layout jumps on switch).
const fill = { width: '100%' }

/** Core API: a strip with panels that switch. The strip is centred (`.panels-demo a-tabs`)
 *  and the panels fill the full width, so switching tabs never reflows the preview. */
export function Basic() {
  useElements()
  return (
    <Tabs className="panels-demo" style={fill} defaultValue="account" label="Settings">
      <Tab value="account" label="Account" icon="home" />
      <Tab value="security" label="Security" />
      <Tab value="billing" label="Billing" />
      <TabPanel value="account" style={panel}><p style={{ margin: 0 }}>Profile, email, and password.</p></TabPanel>
      <TabPanel value="security" style={panel}><p style={{ margin: 0 }}>Two-factor auth and active sessions.</p></TabPanel>
      <TabPanel value="billing" style={panel}><p style={{ margin: 0 }}>Plan, invoices, and payment method.</p></TabPanel>
    </Tabs>
  )
}

const triad = (
  <>
    <Tab value="a" label="Overview" />
    <Tab value="b" label="Activity" />
    <Tab value="c" label="Settings" />
  </>
)

export function Priorities() {
  useElements()
  return (
    <div style={col}>
      <Tabs defaultValue="a" priority="primary">{triad}</Tabs>
      <Tabs defaultValue="a" priority="secondary">{triad}</Tabs>
      <Tabs defaultValue="a" priority="tertiary">{triad}</Tabs>
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
        <Tabs key={tone} defaultValue="a" priority={priority} tone={tone} style={{ alignSelf: 'center' }}>
          <Tab value="a" label="Overview" />
          <Tab value="b" label="Activity" />
          <Tab value="c" label="Settings" />
        </Tabs>
      ))}
    </div>
  )
}

export function Sizes() {
  useElements()
  const row = (
    <>
      <Tab value="a" label="One" /><Tab value="b" label="Two" /><Tab value="c" label="Three" />
    </>
  )
  return (
    <div style={col}>
      <Tabs defaultValue="a" size="small">{row}</Tabs>
      <Tabs defaultValue="a" size="medium">{row}</Tabs>
      <Tabs defaultValue="a" size="large">{row}</Tabs>
    </div>
  )
}

/** One vertical strip at a given priority (Orientation matrix column). */
export function VerticalStrip({ priority }: { priority?: 'primary' | 'secondary' | 'tertiary' }) {
  useElements()
  return (
    <Tabs defaultValue="general" orientation="vertical" priority={priority} label="Workspace">
      <Tab value="general" label="General" />
      <Tab value="members" label="Members" />
      <Tab value="integrations" label="Integrations" />
    </Tabs>
  )
}

/** Tab content: a leading icon, an arbitrary child (a counter Tag), and a trailing
 *  icon used as a status dot — the editor "unsaved changes" pattern. */
export function IconsContent() {
  useElements()
  return (
    <Tabs defaultValue="app" label="Open files">
      <Tab value="app" icon="braces">app.tsx <Tag size="small" nocaps value="2" /></Tab>
      <Tab value="readme" label="README.md" icon="file" />
      <Tab value="styles" icon="file" iconTrailing="circle-small-solid">styles.css</Tab>
    </Tabs>
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

/** Default overflow: a strip wider than its container ellipsizes the labels. Fills the
 *  preview width (small side margins) with enough tabs to overflow it. Each tab carries a
 *  `truncatedOnly` tooltip, so hovering a clipped tab reveals its full label. */
export function Overflow() {
  useElements()
  return (
    <div style={{ width: '100%', padding: '0 6px', boxSizing: 'border-box' }}>
      <Tabs defaultValue="overview" label="Sections">
        {OVERFLOW_TABS.map(({ value, label }) => (
          <Tab key={value} value={value}>
            {label}
            <Tooltip truncatedOnly delay={0}>{label}</Tooltip>
          </Tab>
        ))}
      </Tabs>
    </div>
  )
}

/** Styling: opt back into horizontal scrolling (full labels, scrollbar). */
export function ScrollTabs() {
  useElements()
  return (
    <div className="scroll-tabs" style={{ maxWidth: '300px' }}>
      <Tabs defaultValue="overview" label="Sections">
        <Tab value="overview" label="Overview" />
        <Tab value="activity" label="Activity" />
        <Tab value="settings" label="Settings" />
        <Tab value="members" label="Members" />
        <Tab value="billing" label="Billing" />
        <Tab value="integrations" label="Integrations" />
        <Tab value="notifications" label="Notifications" />
        <Tab value="permissions" label="Permissions" />
        <Tab value="audit" label="Audit log" />
      </Tabs>
    </div>
  )
}

/** Styling: equal-width tabs that fill the strip (varying label lengths → same width). */
export function EqualWidth() {
  useElements()
  return (
    <div className="equal-tabs" style={{ width: '100%' }}>
      <Tabs defaultValue="all" label="Filter">
        <Tab value="all" label="All" />
        <Tab value="assigned" label="Assigned to me" />
        <Tab value="recent" label="Recent" />
        <Tab value="archived" label="Archived" />
      </Tabs>
    </div>
  )
}

/** Styling: let labels wrap so the tabs grow taller instead of truncating. */
export function WrapTabs() {
  useElements()
  return (
    <div className="wrap-tabs" style={{ maxWidth: '300px' }}>
      <Tabs defaultValue="a" label="Reports">
        <Tab value="a" label="Quarterly revenue" />
        <Tab value="b" label="Customer retention" />
        <Tab value="c" label="Product analytics" />
      </Tabs>
    </div>
  )
}

/** Styling: squarer primary track + pill, heavier label, roomier track. */
export function SquareTabs() {
  useElements()
  return (
    <Tabs className="square-tabs" defaultValue="a" label="Sections">
      <Tab value="a" label="Overview" />
      <Tab value="b" label="Activity" />
      <Tab value="c" label="Settings" />
    </Tabs>
  )
}

/** Styling: a tertiary strip whose sliding underline is recoloured, thinned to 1px, and
 *  given a glowing box-shadow — the glow rides the `::before` slider, so it slides with the
 *  line (no noslide). */
export function TertiaryGlow() {
  useElements()
  return (
    <Tabs className="glow-tabs" priority="tertiary" defaultValue="a" label="Sections">
      <Tab value="a" label="Overview" />
      <Tab value="b" label="Activity" />
      <Tab value="c" label="Settings" />
    </Tabs>
  )
}

/** Styling: noslide — the highlight snaps between tabs instead of sliding. */
export function NoSlide() {
  useElements()
  return (
    <Tabs defaultValue="a" noslide label="Sections">
      <Tab value="a" label="Overview" />
      <Tab value="b" label="Activity" />
      <Tab value="c" label="Settings" />
    </Tabs>
  )
}

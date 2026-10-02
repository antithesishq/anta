// Temporary review mock: a "components in context" composition built from
// Anta components, rendered by /components-in-context/ under two token
// variants. Remove with that page.
import {
  Banner, Breadcrumbs, Button, Checkbox, Expander, Icon, Input, InputDate, InputTime,
  Progress, RadioGroup, Slider, Steps, Switch, Tabs, TabPanel, Tag, Text, Title,
} from '@antadesign/anta'
import s from './ComponentsInContext.module.css'

const RUNS = [
  { id: 1842, name: 'Checkout resilience', branch: 'main', status: 'Running', tone: 'info', icon: 'refresh', time: '1h 22m', checked: true },
  { id: 1841, name: 'Payment recovery', branch: 'main', status: 'Passed', tone: 'success', icon: 'circle-check', time: '2h 04m' },
  { id: 1840, name: 'Inventory consistency', branch: 'release', status: 'Failed', tone: 'critical', icon: 'x', time: '48m' },
  { id: 1839, name: 'Session failover', branch: 'main', status: 'Queued', tone: 'neutral', icon: 'clock', time: '—' },
] as const

// Stacked core-hours bars: [test run, multiverse debugger, causality analysis].
const BARS: [string, number, number, number][] = [
  ['Thu', 68, 2.5, 5], ['Fri', 43, 5, 0], ['Sat', 55, 0, 5], ['Sun', 43, 0, 0],
  ['Mon', 30, 15, 5], ['Tue', 48, 0, 0], ['Wed', 36, 5, 1.5],
]

function tabLabel(text: string, count: number) {
  return <>{text} <Tag size="small" value={String(count)} /></>
}

export default function ComponentsInContext() {
  return (
    <div class={s.container}>
      <header class={s.top}>
        <div>
          <Text size="small" priority="tertiary">ANTA · COMPONENT SHOWCASE</Text>
          <Title level={1}>Components in context</Title>
        </div>
        <Text size="small" priority="tertiary" className={s.meta}>Antithesis theme<br />Composition study · 01</Text>
      </header>

      <div class={s.grid}>
        <section class={`${s.card} ${s.runs}`}>
          <Breadcrumbs size="small" items={[{ label: 'Projects', href: '#' }, { label: 'Checkout service', current: true }]} />
          <div class={s.cardHead}>
            <div>
              <Title level={2}>Recent test runs</Title>
              <Text size="small" priority="tertiary">Checkout service · Last 24 hours</Text>
            </div>
            <div class={s.actions}>
              <Button tone="brand" label="Compare" />
              <Button priority="primary" tone="brand" icon="plus" label="New run" />
            </div>
          </div>

          <Tabs priority="tertiary" defaultValue="all" label="Run filter" options={[
            { value: 'all', children: tabLabel('All runs', 4) },
            { value: 'failed', children: tabLabel('Failed', 1) },
            { value: 'running', children: tabLabel('Running', 1) },
          ]} />

          <div class={s.toolbar}>
            <Button icon="filter" label="Filter" className={s.square} />
            <Input placeholder="Search runs…" leading={<Icon shape="search" />} style={{ flex: '1 1 200px' }} />
            <Input leading="Scope:" defaultValue="Network" style={{ width: '180px' }} />
            <Button priority="tertiary" icon="filter-x" label="Clear all" />
            <Button priority="quaternary" icon="more" aria-label="More actions" />
          </div>

          <div class={s.tableWrap}>
            <table class={s.table}>
              <thead>
                <tr>
                  <th class={s.check}><Checkbox aria-label="Select all runs" /></th>
                  <th>Run</th><th>Scope</th><th>Status</th><th>Time</th><th class={s.open}></th>
                </tr>
              </thead>
              <tbody>
                {RUNS.map((r) => (
                  <tr class={r.checked ? s.selected : undefined}>
                    <td class={s.check}><Checkbox tone="brand" defaultChecked={r.checked} aria-label={`Select ${r.name}`} /></td>
                    <td>
                      <div class={s.runName}>{r.name}</div>
                      <Text size="small" priority="tertiary">#{r.id} · {r.branch}</Text>
                    </td>
                    <td><Tag size="small" label="Network" /></td>
                    <td><Tag size="small" tone={r.tone} icon={r.icon} label={r.status} /></td>
                    <td class={s.num}>{r.time}</td>
                    <td class={s.open}><Button priority="quaternary" icon="external-link" aria-label={`Open ${r.name}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class={s.cardFoot}>
            <Text size="small" priority="tertiary">Showing 5 runs</Text>
            <Button priority="quaternary" tone="brand" size="small" iconTrailing="arrow-right" label="View all runs" />
          </div>
        </section>

        <section class={`${s.card} ${s.form}`}>
          <div>
            <Title level={2}>Create a test run</Title>
            <Text size="small" priority="tertiary">Choose what to test and when to start</Text>
          </div>
          <Input label="Run name" defaultValue="Checkout resilience" />
          <Input label="Test launcher" defaultValue="Async Platform" />
          <RadioGroup name="mode" label="Run mode" orientation="horizontal" defaultValue="scheduled" options={[
            { value: 'now', label: 'Run now' }, { value: 'scheduled', label: 'Scheduled' },
          ]} />
          <div class={s.pair}>
            <InputDate label="Start date" defaultValue="2026-09-18" />
            <InputTime label="Time · London" defaultValue="09:30" />
          </div>
          <Checkbox tone="brand" defaultChecked label="Create debugging sessions" />
          <Expander title="Advanced settings" defaultOpen indicatorPlacement="end">
            <Slider label="Maximum run duration" min={30} max={480} step={30} defaultValue={120} valueSuffix=" min"
              markers={[{ value: 30, label: '30 min' }, { value: 480, label: '8 hours' }]} />
          </Expander>
          <div class={s.actions}>
            <Button priority="primary" tone="brand" iconTrailing="arrow-right" label="Create run" />
            <Button tone="brand" label="Save draft" />
            <Button label="Cancel" />
          </div>
        </section>

        <section class={`${s.card} ${s.chart}`}>
          <div class={s.cardHead}>
            <Title level={2}>Core hours</Title>
            <Tabs priority="primary" size="small" defaultValue="week" label="Range" options={[
              { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' },
            ]} />
          </div>
          <div class={s.big}>324.6 <Text inline size="small" priority="tertiary">core hours</Text></div>
          <div class={s.legend}>
            <span><i class={s.c1} />Test run</span><span><i class={s.c2} />Multiverse debugger</span><span><i class={s.c3} />Causality analysis</span>
          </div>
          <div class={s.plot}>
            <div class={s.axis}>{[80, 60, 40, 20, 0].map((v) => <span>{v}</span>)}</div>
            <div class={s.bars}>
              {BARS.map(([day, a, b, c]) => (
                <div class={s.barCol}>
                  <div class={s.stack}>
                    <div class={s.c3} style={{ height: `${c * 1.25}%` }} />
                    <div class={s.c2} style={{ height: `${b * 1.25}%` }} />
                    <div class={s.c1} style={{ height: `${a * 1.25}%` }} />
                  </div>
                  <Text size="small" priority="tertiary">{day}</Text>
                </div>
              ))}
            </div>
          </div>
          <div class={s.cardFoot}>
            <Text size="small" priority="tertiary">10–16 Sep</Text>
            <Text size="small" priority="tertiary">Today · 55.6 core h</Text>
          </div>
        </section>

        <div class={s.middle}>
          <section class={s.card}>
            <div class={s.cardHead}>
              <div>
                <Title level={2}>Checkout resilience</Title>
                <Text size="small" priority="tertiary">Run #1842 · Started at 10:24</Text>
              </div>
              <Tag size="small" tone="info" icon="refresh" label="Running" />
            </div>
            <Steps priority="secondary" defaultValue="setup" label="Run progress" options={[
              { value: 'build', label: 'Build', state: 'completed' },
              { value: 'setup', label: 'Setup', state: 'loading' },
              { value: 'review', label: 'Review', state: 'incomplete' },
            ]}>
              <TabPanel value="setup"><span /></TabPanel>
            </Steps>
            <Progress value={68} label="complete" hint="About 38 min left" tone="brand" />
            <div class={s.cardFoot}>
              <Button tone="brand" iconTrailing="external-link" label="Open run" />
              <Button label="Pause" icon="minus" />
            </div>
          </section>
          <Banner tone="success" round message="Your changes were saved">
            <Text size="small" priority="tertiary">Your next run will use these settings</Text>
          </Banner>
        </div>

        <section class={`${s.card} ${s.notify}`}>
          <Title level={2}>Notifications</Title>
          <Switch tone="brand" defaultChecked label="Delete workspace" hint="This cannot be undone" />
          <Checkbox tone="brand" defaultChecked label="Only when a property fails" />
          <Banner tone="info" message="Changes apply to new runs." />
        </section>
      </div>
    </div>
  )
}

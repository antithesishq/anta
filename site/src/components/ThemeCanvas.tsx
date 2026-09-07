import {
  Avatar, Banner, Box, Breadcrumbs, Button, ButtonCopy, Capture, Card,
  Checkbox, Dialog, Expander, Icon, Input, InputAutocomplete, InputDate,
  InputTime, Loader, Menu, MenuGroup, MenuItem, MenuSeparator, Progress,
  RadioGroup, Select, SelectFaceted, Slider, Steps, Switch, Tabs, Tag,
  Text, Title, Toaster, Tooltip,
} from '@antadesign/anta'
import styles from './ThemeCanvas.module.css'

const tones = ['neutral', 'brand', 'info', 'success', 'warning', 'critical'] as const

export default function ThemeCanvas() {
  return (
    <Capture>
      <Box className={styles.canvas}>
        <Breadcrumbs size="small" items={[{ label: 'Workspace', icon: 'home' }, { label: 'Overview', current: true }]} />
        <div className={styles.identity}>
          <Avatar name="Alex Morgan" seed="theme-preview" size={40} round />
          <div>
            <Title level={3}>Make yourself at home</Title>
            <Text priority="tertiary" size="small">A place for your next idea.</Text>
          </div>
          <Button icon="dots-vertical" aria-label="Workspace actions" priority="tertiary" />
          <Menu>
            <MenuGroup label="Workspace">
              <MenuItem label="Rename" icon="edit" />
              <MenuItem label="Share" icon="share" />
            </MenuGroup>
            <MenuSeparator />
            <MenuItem label="Archive" icon="folder-close" tone="critical" />
          </Menu>
        </div>
        <Tabs label="Workspace view" defaultValue="overview" options={[
          { value: 'overview', label: 'Overview' },
          { value: 'activity', label: 'Activity' },
          { value: 'settings', label: 'Settings' },
        ]} />

        <section className={styles.group} aria-label="Buttons and tags">
          <div className={styles.row}>
            <Button tone="brand" priority="primary" icon="plus">New project</Button>
            <Button tone="brand" priority="secondary">Share</Button>
            <Button priority="tertiary">Learn more</Button>
            <Button priority="quaternary">Help</Button>
            <Button disabled>Unavailable</Button>
          </div>
          <div className={styles.row}>
            {tones.map(tone => <Tag key={tone} tone={tone}>{tone === 'neutral' ? 'Draft' : tone === 'brand' ? 'Design' : tone}</Tag>)}
          </div>
          <div className={styles.row}>
            <Tag tone="brand" priority="primary">Primary</Tag>
            <Tag tone="brand" priority="secondary">Secondary</Tag>
            <Tag tone="brand" priority="tertiary">Tertiary</Tag>
            <ButtonCopy copy="https://anta.design" label="Copy link" size="small" />
          </div>
        </section>

        <Card header="A fresh start" subtitle="Your workspace is ready" tone="brand" icon="sparkles">
          <Text size="small">Bring your ideas together, add a few details, and make something yours.</Text>
          <Progress className={styles.cardProgress} value={64} tone="brand" label="Project setup" hint="64%" />
        </Card>

        <section className={styles.group} aria-label="Form controls">
          <Title level={5}>Project details</Title>
          <Input label="Project name" defaultValue="A new perspective" hint="You can change this later." />
          <div className={styles.fields}>
            <Select label="Visibility" defaultValue="team" options={[
              { value: 'team', label: 'Team', icon: 'circle-user' },
              { value: 'private', label: 'Only you', icon: 'eye-closed' },
              { value: 'public', label: 'Everyone', icon: 'eye' },
            ]} />
            <InputAutocomplete label="Framework" defaultValue="Preact" suggestions={['React', 'Preact', 'Astro', 'Vue', 'Svelte']} />
            <InputDate label="Due date" defaultValue="2026-09-18" />
            <InputTime label="Start time" defaultValue="09:30" />
          </div>
          <Input label="Description" multiline defaultValue="A small space to explore a big idea." />
          <Input label="Project URL" defaultValue="already-taken" status="critical" hint="This address is already in use." />
          <div className={styles.row}>
            <Checkbox label="Include a README" defaultChecked toneSelected="brand" />
            <Switch label="Notifications" defaultChecked tone="brand" />
          </div>
          <RadioGroup name="theme-preview-plan" defaultValue="team" toneSelected="brand" options={[
            { value: 'personal', label: 'Personal' },
            { value: 'team', label: 'Team' },
            { value: 'enterprise', label: 'Enterprise' },
          ]} />
          <Slider label="Capacity" defaultValue={64} valueSuffix="%" tone="brand" />
          <SelectFaceted label="Filter projects" facets={[
            { key: 'status', label: 'Status', kind: 'single', options: ['Planning', 'In progress', 'Complete'] },
            { key: 'label', label: 'Label', kind: 'multiple', options: ['Design', 'Engineering', 'Research'] },
          ]} />
        </section>

        <section className={styles.group} aria-label="Feedback and navigation">
          <Title level={5}>Keep things moving</Title>
          <Steps label="Project stages" defaultValue="design" tone="brand" options={[
            { value: 'plan', label: 'Plan', state: 'completed' },
            { value: 'design', label: 'Design', state: 'incomplete' },
            { value: 'ship', label: 'Ship', state: 'incomplete' },
          ]} />
          <Banner tone="info" message="Your team can see this project." />
          <Banner tone="success" message="All changes saved." />
          <Banner tone="warning" message="You’re approaching your storage limit." />
          <Banner tone="critical" message="One file couldn’t be uploaded." />
          <div className={styles.row}>
            <Loader tone="brand" label="Syncing" />
            <Text size="small" priority="tertiary">Syncing your workspace</Text>
            <Icon shape="cloud-upload" />
          </div>
          <Progress value={42} tone="brand" round label="Uploading assets" />
          <Expander title="A little more detail" priority="secondary" tone="brand">
            <Text size="small">Good details make the whole experience feel considered.</Text>
          </Expander>
          <div className={styles.row}>
            <Button data-dialog-open="theme-preview-dialog">Open dialog</Button>
            <Button onClick={() => Toaster.manager.add(id => (
              <Banner tone="success" message="Your project was saved." onDismiss={() => Toaster.manager.dismiss(id)} />
            ), { duration: 4000, placement: 'bottom-right' })}>Show toast</Button>
            <span><Button priority="tertiary" icon="info" aria-label="About this preview" /><Tooltip>Try the controls to explore the theme.</Tooltip></span>
          </div>
          <Dialog name="theme-preview-dialog" header="Ready to begin?" footer={<Button tone="brand" priority="primary" data-dialog-close="theme-preview-dialog">Let’s go</Button>}>
            <Text>You have everything you need to start your next project.</Text>
          </Dialog>
          <Toaster />
        </section>

        <section className={styles.group} aria-label="Typography and surfaces">
          {([1, 2, 3, 4, 5, 6] as const).map(level => <Title key={level} level={level}>Title {level}</Title>)}
          <Text>Primary text brings the important things into focus.</Text>
          <Text priority="secondary">Secondary text adds context.</Text>
          <Text priority="tertiary">Tertiary text keeps the quieter details close.</Text>
          <div className={styles.swatches}>
            {[1, 2, 3, 4, 5].map(level => <div key={level} style={{ background: `var(--bg-${level})`, borderColor: `var(--border-${6 - level})` }}>{level}</div>)}
          </div>
          <table>
            <thead><tr><th>Project</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Website</td><td><Tag tone="success">Ready</Tag></td></tr>
              <tr><td>Mobile app</td><td><Tag tone="brand">In progress</Tag></td></tr>
            </tbody>
          </table>
        </section>
      </Box>
    </Capture>
  )
}

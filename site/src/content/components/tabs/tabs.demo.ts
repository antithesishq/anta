/**
 * Demo source for the Tabs playground. Kept in a sibling .ts file (not inlined in
 * the .mdx) so Astro's MDX pipeline doesn't mangle the template literal's
 * indentation — see button.demo.ts. The panel framing lives in the playground's
 * CSS tab (see `initialCss` in tabs.mdx).
 */
export default `import { Tabs, TabPanel } from '@antadesign/anta'

<Tabs
  defaultValue="overview"
  label="Project sections"
  style={{ marginLeft: '16px' }}
  options={[
    { value: 'overview', label: 'Overview', icon: 'home' },
    { value: 'activity', label: 'Activity', icon: 'clock' },
    { value: 'settings', label: 'Settings', icon: 'more' },
  ]}
>
  <TabPanel value="overview">
    <p style={{ margin: 0 }}>A quick summary of the project and its status.</p>
  </TabPanel>
  <TabPanel value="activity">
    <p style={{ margin: 0 }}>Recent events, commits, and comments.</p>
  </TabPanel>
  <TabPanel value="settings">
    <p style={{ margin: 0 }}>Names, visibility, and danger-zone controls.</p>
  </TabPanel>
</Tabs>
`

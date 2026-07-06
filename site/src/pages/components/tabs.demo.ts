/**
 * Demo source for the Tabs playground. Kept in a sibling .ts file (not inlined in
 * the .mdx) so Astro's MDX pipeline doesn't mangle the template literal's
 * indentation — see button.demo.ts. The panel framing lives in the playground's
 * CSS tab (see `initialCss` in tabs.mdx).
 */
export default `import { Tabs, Tab, TabPanel } from '@antadesign/anta'

<Tabs defaultValue="overview" label="Project sections" style={{ marginLeft: '16px' }}>
  <Tab value="overview" label="Overview" icon="home" />
  <Tab value="activity" label="Activity" icon="clock" />
  <Tab value="settings" label="Settings" icon="more" />

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

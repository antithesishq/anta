/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Tabs } from '../src/components/Tabs'
import { TabPanel } from '../src/components/TabPanel'
import { Steps } from '../src/components/Steps'
import '../src/elements/a-steps'
import '../src/elements/a-tabs'
import '../src/elements/a-tab'
import '../src/elements/a-tabpanel'

render(
  <>
    <section id="basic-tabs">
      <Tabs
        defaultValue="account"
        label="Settings"
        options={[
          { value: 'account', label: 'Account' },
          { value: 'security', label: 'Security' },
          { value: 'billing', label: 'Billing' },
        ]}
      >
        <TabPanel value="account" tabIndex={0} data-panel="account">Account settings</TabPanel>
        <TabPanel value="security">Security settings</TabPanel>
        <TabPanel value="billing">Billing settings</TabPanel>
      </Tabs>
    </section>
    <section id="sibling-tabs">
      <Tabs defaultValue="first" options={[{ value: 'first', label: 'First' }, { value: 'next', label: 'Next' }]}>
        <TabPanel value="first">First panel</TabPanel>
        <TabPanel value="next">Next panel</TabPanel>
      </Tabs>
      <Tabs defaultValue="second" options={[{ value: 'second', label: 'Second' }, { value: 'later', label: 'Later' }]}>
        <TabPanel value="second">Second panel</TabPanel>
        <TabPanel value="later">Later panel</TabPanel>
      </Tabs>
    </section>
    <section id="nested-tabs">
      <Tabs defaultValue="outer" options={[{ value: 'outer', label: 'Outer' }, { value: 'other', label: 'Other' }]}>
        <Tabs defaultValue="inner" options={[{ value: 'inner', label: 'Inner' }]}>
          <TabPanel value="inner">Inner panel</TabPanel>
        </Tabs>
        <TabPanel value="outer">Outer panel</TabPanel>
        <TabPanel value="other">Other panel</TabPanel>
      </Tabs>
    </section>
    <section id="nested-steps">
      <Steps defaultValue="stage" options={[{ value: 'stage', label: 'Stage', state: 'loading' }]}>
        <Tabs defaultValue="inner" options={[{ value: 'inner', label: 'Inner' }]}>
          <TabPanel value="inner">Inner step panel</TabPanel>
        </Tabs>
        <TabPanel value="stage">Stage panel</TabPanel>
      </Steps>
    </section>
  </>,
  document.querySelector('#mount')!,
)

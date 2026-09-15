/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Tabs } from '../src/components/Tabs'
import { TabPanel } from '../src/components/TabPanel'
import '../src/elements/a-tabs'
import '../src/elements/a-tab'
import '../src/elements/a-tabpanel'

render(
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
  </Tabs>,
  document.querySelector('#mount')!,
)

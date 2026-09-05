import { h, render } from 'preact'
import { configure } from '../src/jsx-runtime'
import { Box } from '../src/components/Box'
import { Tabs } from '../src/components/Tabs'
import '../src/elements/a-box'
import '../src/elements/a-tab'
import '../src/elements/a-tabs'

configure(h)

// Test-only renderer bridge. Production consumers keep all configuration declarative.
Object.assign(window, {
  renderBox: (props: object) => render(h(Box, props), document.body),
  renderTabsInBox: (props: object) => render(h(Box, props, h(Tabs, {
    label: 'Views', defaultValue: 'first', noslide: true,
    options: [{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }],
  })), document.body),
})

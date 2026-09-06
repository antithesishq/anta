import { h, render } from 'preact'
import { configure } from '../src/jsx-runtime'
import { customEventHandler, finiteNumber } from '../src/anta_helpers'
import { Capture } from '../src/components/Capture'
import { Box } from '../src/components/Box'
import { Tabs } from '../src/components/Tabs'
import { Select } from '../src/components/Select'
import '../src/elements/a-capture'
import '../src/elements/a-box'
import '../src/elements/a-input'
import '../src/elements/a-menu'
import '../src/elements/a-tab'
import '../src/elements/a-tabs'

configure(h)

// Test-only renderer bridge. Production consumers keep all configuration declarative.
Object.assign(window, {
  customEventHandler, finiteNumber,
  renderBox: (props: object) => render(h(Box, props), document.body),
  renderCapture: (props: object) => render(h(Capture, props), document.body),
  renderTabsInCapture: (props: object) => render(h(Capture, props, h(Tabs, {
    label: 'Views', defaultValue: 'first', noslide: true,
    options: [{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }],
  })), document.body),
  renderSelectInCapture: (props: object) => render(h(Capture, props, h(Select, {
    label: 'Rows', options: Array.from({ length: 50 }, (_, i) => `Row ${i}`),
  })), document.body),
})

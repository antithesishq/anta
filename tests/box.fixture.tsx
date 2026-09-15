/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Box } from '../src/components/Box'
import '../src/elements/a-box'
import '../src/elements/a-tooltip'

Object.assign(window, {
  renderBox(props: Parameters<typeof Box>[0]) {
    render(<Box {...props}><div style={{ width: 600, height: 600 }} /></Box>, document.querySelector('#mount')!)
  },
})

/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Panel } from '../src/components/Panel'
import '../src/elements/a-panel'
import '../src/elements/a-box'
import '../src/elements/a-capture'
import '../src/elements/a-button'
import '../src/elements/a-input'
import '../src/elements/a-menu'
import '../src/elements/a-dialog'

Object.assign(window, {
  renderPanel(props: Parameters<typeof Panel>[0]) {
    render(<Panel {...props}><input aria-label="Note" defaultValue="Draft" /></Panel>, document.querySelector('#mount')!)
  },
})

/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Title } from '../src/components/Title'
import '../src/elements/a-title.css'
import '../src/elements/a-tooltip'

Object.assign(window, {
  renderTitle(props: Parameters<typeof Title>[0], children: string) {
    render(<Title {...props}>{children}</Title>, document.querySelector('#mount')!)
  },
})

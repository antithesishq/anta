/** @jsxImportSource @antadesign/anta */
import { render } from 'preact'
import { Calendar } from '../src/components/Calendar'
import '../src/elements/a-calendar'
import '../src/elements/a-button'
import '../src/elements/a-menu'
import '../src/elements/a-menu-item'

Object.assign(window, {
  renderCalendar(props: Parameters<typeof Calendar>[0]) {
    render(<Calendar {...props} locale="en-US" />, document.querySelector('#mount')!)
  },
})

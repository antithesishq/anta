import { register_a_progress } from './a-progress'
import './a-progress.css'

export { AProgressElement, register_a_progress } from './a-progress'

// typeof guard: direct reference to undeclared variable throws ReferenceError, typeof does not
if (typeof customElements !== 'undefined') {
  register_a_progress()
}

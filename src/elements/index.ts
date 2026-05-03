import { register_a_progress } from './a-progress'
import { register_a_text } from './a-text'
import { register_a_icon } from './a-icon'
import './a-progress.css'
import './a-text.css'
import './a-icon.css'
import './a-icon.shapes.css'

export { AProgressElement, register_a_progress } from './a-progress'
export { ATextElement, register_a_text } from './a-text'
export { AIconElement, register_a_icon } from './a-icon'

// typeof guard: direct reference to undeclared variable throws ReferenceError, typeof does not
if (typeof customElements !== 'undefined') {
  register_a_progress()
  register_a_text()
  register_a_icon()
}

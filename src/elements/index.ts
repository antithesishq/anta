import { register_a_progress } from './a-progress'
import './a-progress.css'

export { AProgressElement, register_a_progress } from './a-progress'

// Auto-register in browser context
if (typeof customElements !== 'undefined') {
  register_a_progress()
}

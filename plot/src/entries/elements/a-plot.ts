import { register_a_plot_surface } from './a-plot-surface'
import { register_a_tooltip } from '@antadesign/anta/elements/a-tooltip'
import { create_plot_element } from '../../browser/plot_element'

if (typeof customElements !== 'undefined') {
    // Keep the dependency explicit: split bundles may evaluate registration chunks out of order.
    register_a_plot_surface()
    register_a_tooltip()

    if (!customElements.get('a-plot')) {
        customElements.define('a-plot', create_plot_element())
    }
}

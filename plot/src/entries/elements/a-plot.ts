import './a-plot-surface'
import { register_a_tooltip } from '@antadesign/anta/elements/a-tooltip'
import { create_plot_element } from '../../browser/plot_element'

if (typeof customElements !== 'undefined') {
    register_a_tooltip()

    if (!customElements.get('a-plot')) {
        customElements.define('a-plot', create_plot_element())
    }
}

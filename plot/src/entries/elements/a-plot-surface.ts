import { register_a_box } from '@antadesign/anta/elements/a-box'
import { register_a_capture } from '@antadesign/anta/elements/a-capture'
import { register_a_button } from '@antadesign/anta/elements/a-button'
import { register_a_icon } from '@antadesign/anta/elements/a-icon'
import { create_plot_surface_element } from '../../browser/plot_surface'

export function register_a_plot_surface(): void {
    if (typeof customElements === 'undefined') return
    register_a_box()
    register_a_capture()
    register_a_button()
    register_a_icon()

    if (!customElements.get('a-plot-surface')) {
        customElements.define('a-plot-surface', create_plot_surface_element())
    }
}

register_a_plot_surface()

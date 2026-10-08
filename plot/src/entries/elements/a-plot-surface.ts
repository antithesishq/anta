import { register_a_box } from '@antadesign/anta/elements/a-box'
import { register_a_capture } from '@antadesign/anta/elements/a-capture'
import { register_a_menu } from '@antadesign/anta/elements/a-menu'
import { register_a_menu_item } from '@antadesign/anta/elements/a-menu-item'
import { create_plot_surface_element } from '../../browser/plot_surface'

export function register_a_plot_surface(): void {
    if (typeof customElements === 'undefined') return
    register_a_box()
    register_a_capture()
    register_a_menu()
    register_a_menu_item()

    if (!customElements.get('a-plot-surface')) {
        customElements.define('a-plot-surface', create_plot_surface_element())
    }
}

register_a_plot_surface()

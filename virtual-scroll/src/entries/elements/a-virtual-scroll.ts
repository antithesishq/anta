import { register_a_virtual_scroll } from '../../elements/virtual-scroll-element'

// Registration is explicit here, so bundlers that honor `sideEffects` keep it.
register_a_virtual_scroll()

export { AVirtualScrollElement, register_a_virtual_scroll } from '../../elements/virtual-scroll-element'
export type { AVirtualScrollAttributes } from '../../elements/attributes'

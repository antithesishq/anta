import { definePlotElement } from './index'

/** Await registration in a browser; importing this entry without a registry is a no-op. */
export const plotElementReady = typeof customElements === 'undefined'
    ? Promise.resolve()
    : definePlotElement()

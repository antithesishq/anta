import '../browser/plot.css'
import { definePlotSurfaceElement } from '../browser/index'

/** Register the shared surface on import; server-side imports are a no-op. */
export const plotSurfaceElementReady = typeof customElements === 'undefined'
    ? Promise.resolve()
    : definePlotSurfaceElement()

void plotSurfaceElementReady.catch(error => console.error('plot: surface registration failed.', error))

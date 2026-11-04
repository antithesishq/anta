import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import { noResourceLeak } from '@antithesishq/bombadil/browser/extras/resources'

export const heapGrowth = noResourceLeak({ metric: 'js_heap_used', growthLimit: 100 * 1024 ** 2, windowMillis: 60_000 })
export const domNodeGrowth = noResourceLeak({ metric: 'dom_nodes', growthLimit: 4000, windowMillis: 60_000 })
export const listenerGrowth = noResourceLeak({ metric: 'js_event_listeners', growthLimit: 1600, windowMillis: 60_000 })

const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advance = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
export const interactions = actions(() => revision.current === null ? ['Wait'] : [advance()])

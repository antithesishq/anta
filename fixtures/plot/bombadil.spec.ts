import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import { noResourceLeak } from '@antithesishq/bombadil/browser/extras/resources'
import { plotActions, plotKeyboard, plotViewportSizes } from './actions.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export * from './properties.ts'

export const plotHeapGrowth = noResourceLeak({
  metric: 'js_heap_used',
  growthLimit: 100 * 1024 ** 2,
  windowMillis: 60_000,
})

const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advance = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
const choices = weighted([[6, plotActions], [2, plotKeyboard], [2, actions(() => [advance()])], [1, plotViewportSizes]])
export const interactions = actions(() => revision.current === null ? ['Wait'] : choices.generate())

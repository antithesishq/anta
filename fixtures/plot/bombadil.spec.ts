import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import { plotActions, plotViewportSizes } from './actions.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export * from './properties.ts'

const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advance = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
const choices = weighted([[6, plotActions], [2, actions(() => [advance()])], [1, plotViewportSizes]])
export const interactions = actions(() => revision.current === null ? ['Wait'] : choices.generate())

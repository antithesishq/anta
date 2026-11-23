import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import { clicks } from '@antithesishq/bombadil/browser/defaults/actions'
import { inspectorKeyboard } from './actions.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export * from './properties.ts'

// Run with `?only=inspector`. The combined campaign spends few actions on the
// Inspector's keys, so it rarely reaches a focused ⋯; here they lead.
const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advance = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
const choices = weighted([[12, inspectorKeyboard], [3, clicks], [1, actions(() => [advance()])]])
export const interactions = actions(() => revision.current === null ? ['Wait'] : choices.generate())

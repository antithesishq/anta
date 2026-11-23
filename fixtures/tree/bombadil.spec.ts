import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import { clicks } from '@antithesishq/bombadil/browser/defaults/actions'
import { treeKeyboard } from './actions.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export * from './properties.ts'

// Run with `?only=tree`. The combined campaign spends few actions on the
// tree's keys, so it rarely reaches a row's actions; here they lead.
const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advance = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
const choices = weighted([[12, treeKeyboard], [3, clicks], [1, actions(() => [advance()])]])
export const interactions = actions(() => revision.current === null ? ['Wait'] : choices.generate())

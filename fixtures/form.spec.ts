import { actions, registerCustomAction } from '@antithesishq/bombadil/browser'

export { disabledControlsAreExcludedFromSubmission } from './form-properties.ts'

const advance = registerCustomAction('advanceFormFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
export const interactions = actions(() => [advance()])

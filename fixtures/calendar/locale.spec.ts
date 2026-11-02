import { actions, registerCustomAction } from '@antithesishq/bombadil/browser'

export { inputDateLocalePreservesDisplayAndValue } from './properties.ts'

const advance = registerCustomAction('advanceCalendarLocaleFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
export const interactions = actions(() => [advance()])

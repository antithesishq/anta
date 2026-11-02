import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import { clicks, inputs, scroll } from '@antithesishq/bombadil/browser/defaults/actions'
import { sliderDrag, sliderKeyboard } from './slider/actions.ts'
import { radioKeyboard } from './radio-group/actions.ts'
import { tabsKeyboard } from './tabs/actions.ts'
import { inputEditing } from './input/actions.ts'
import { selectOptions } from './select/actions.ts'
import { dialogDismissal } from './dialog/actions.ts'
import { expanderKeyboard } from './expander/actions.ts'
import { plotActions } from './plot/actions.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export * from './form-properties.ts'
export * from './button/properties.ts'
export * from './checkbox/properties.ts'
export * from './radio-group/properties.ts'
export * from './switch/properties.ts'
export * from './slider/properties.ts'
export * from './tabs/properties.ts'
export * from './input/properties.ts'
export * from './calendar/properties.ts'
export * from './select/properties.ts'
export * from './dialog/properties.ts'
export * from './expander/properties.ts'
export * from './plot/properties.ts'

const revision = extract(state => state.document.querySelector('[data-app-fixture]')?.getAttribute('data-app-revision') ?? null)
const advanceApp = registerCustomAction('advanceAppFixture', async (_document, window) => {
  window.dispatchEvent(new Event('fixture:advance'))
})
const appUpdates = actions(() => [advanceApp()])
const choices = weighted([
  [10, clicks],
  [3, inputs],
  [3, scroll],
  [3, sliderKeyboard],
  [3, sliderDrag],
  [3, radioKeyboard],
  [3, tabsKeyboard],
  [6, inputEditing],
  [3, selectOptions],
  [3, dialogDismissal],
  [3, expanderKeyboard],
  [3, plotActions],
  [3, appUpdates],
])

export const interactions = actions(() => revision.current !== null ? choices.generate() : ['Wait'])

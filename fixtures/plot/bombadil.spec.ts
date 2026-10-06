import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForPlotFixture = registerCustomAction(
  'waitForPlotFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="plot"]')) {
      if (Date.now() >= deadline) throw new Error('Plot fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const ready = extract((state) => (
  state.document.querySelector('[data-fixture="plot"]') !== null
))

export const plotReadyActions = actions(() => (
  ready.current ? [] : [waitForPlotFixture()]
))

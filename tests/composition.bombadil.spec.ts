import { actions } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs, scroll } from '@antithesishq/bombadil/browser/defaults/actions'

export const waits = actions(() => ['Wait'])

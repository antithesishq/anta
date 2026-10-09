import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForInputFixture = registerCustomAction(
  'waitForInputFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="input"]')) {
      if (Date.now() >= deadline) throw new Error('Input fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="input"]')
  if (!root) return null

  const host = root.querySelector<HTMLElement & { value: string }>('[data-fixture-target]')
  const control = host?.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? null

  return {
    controlDisabled: control?.disabled ?? null,
    controlReadOnly: control?.readOnly ?? null,
    controlTag: control?.tagName ?? null,
    controlValue: control?.value ?? null,
    filled: host?.matches(':state(filled)') ?? null,
    hostDisabled: host?.hasAttribute('disabled') ?? null,
    hostMultiline: host?.hasAttribute('multiline') ?? null,
    hostReadOnly: host?.hasAttribute('readonly') ?? null,
    hostValue: host?.value ?? null,
    mounted: host !== null,
  }
})

export const inputReadyActions = actions(() => (
  fixture.current === null ? [waitForInputFixture()] : []
))

export const inputStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.mounted) return true

  return current.hostValue === current.controlValue
    && current.filled === ((current.hostValue?.length ?? 0) > 0)
    && current.controlTag === (current.hostMultiline ? 'TEXTAREA' : 'INPUT')
    && current.controlDisabled === current.hostDisabled
    && current.controlReadOnly === current.hostReadOnly
})

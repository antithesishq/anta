import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import { fixtureResourceProperties } from '../resource-properties.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForInputFixture = registerCustomAction(
  'waitForInputFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="input"] [data-fixture-target]').length !== 5) {
      if (Date.now() >= deadline) throw new Error('Input fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="input"]')
  if (!root) return null

  const targets = Array.from(root.querySelectorAll<HTMLElement & { value: string }>('[data-fixture-target]'), (host) => {
    const control = host.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? null
    return {
      controlDisabled: control?.disabled ?? null,
      controlReadOnly: control?.readOnly ?? null,
      controlTag: control?.tagName ?? null,
      controlValue: control?.value ?? null,
      filled: host.matches(':state(filled)'),
      hostDisabled: host.hasAttribute('disabled'),
      hostMultiline: host.hasAttribute('multiline'),
      hostReadOnly: host.hasAttribute('readonly'),
      hostValue: host.value,
    }
  })

  return {
    targets,
  }
})

export const inputReadyActions = actions(() => (
  fixture.current === null ? [waitForInputFixture()] : []
))

export const inputStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true

  return current.targets.every((target: {
    controlDisabled: boolean | null
    controlReadOnly: boolean | null
    controlTag: string | null
    controlValue: string | null
    filled: boolean
    hostDisabled: boolean
    hostMultiline: boolean
    hostReadOnly: boolean
    hostValue: string
  }) => target.hostValue === target.controlValue
    && target.filled === (target.hostValue.length > 0)
    && target.controlTag === (target.hostMultiline ? 'TEXTAREA' : 'INPUT')
    && target.controlDisabled === target.hostDisabled
    && target.controlReadOnly === target.hostReadOnly)
})

const inputResources = fixtureResourceProperties({
  mountedCount: 5,
  mountedSelector: '[data-fixture="input"] [data-fixture-target]',
})

export const inputHasNoDomNodeLeak = inputResources.noDomNodeLeak
export const inputHasNoEventListenerLeak = inputResources.noEventListenerLeak
export const inputHasNoHeapGrowth = inputResources.noHeapGrowth
export const inputHasNoLayoutObjectLeak = inputResources.noLayoutObjectLeak

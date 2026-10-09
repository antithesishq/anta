import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForSelectFacetedFixture = registerCustomAction(
  'waitForSelectFacetedFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="select-faceted"] [data-fixture-target]').length !== 5) {
      if (Date.now() >= deadline) throw new Error('SelectFaceted fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="select-faceted"]')
  if (!root) return null

  const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-fixture-target]'), (trigger) => {
    const menu = trigger.nextElementSibling as (HTMLElement & { isOpen: boolean }) | null
    const checkableRows = menu
      ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"], [role="menuitemradio"]'), (row) => ({
        checked: row.getAttribute('aria-checked'),
        role: row.getAttribute('role'),
      }))
      : []
    const radioSelectionCounts = menu
      ? Array.from(menu.querySelectorAll<HTMLElement>('a-menu'), (group) =>
        group.querySelectorAll(':scope > a-menu-item[role="menuitemradio"][aria-checked="true"]').length)
      : []
    return {
      checkableRows,
      disabled: trigger.hasAttribute('disabled'),
      expanded: trigger.getAttribute('aria-expanded'),
      menuIsOpen: menu?.isOpen ?? null,
      menuOpenState: menu?.matches(':state(open)') ?? null,
      radioSelectionCounts,
      tabIndex: trigger.tabIndex,
    }
  })

  return {
    targets,
  }
})

export const selectFacetedReadyActions = actions(() => (
  fixture.current === null ? [waitForSelectFacetedFixture()] : []
))

export const selectFacetedOpenStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true

  return current.targets.every((target: {
    disabled: boolean
    expanded: string | null
    menuIsOpen: boolean | null
    menuOpenState: boolean | null
    tabIndex: number
  }) => target.expanded === String(target.menuIsOpen)
    && target.menuOpenState === target.menuIsOpen
    && target.tabIndex === (target.disabled ? -1 : 0))
})

export const selectFacetedSelectionIndicatorsAreValid = always(() => {
  const current = fixture.current
  if (current === null) return true

  return current.targets.every((target: {
    checkableRows: Array<{ checked: string | null; role: string | null }>
    radioSelectionCounts: number[]
  }) => target.checkableRows.every((row) =>
    (row.role === 'menuitemcheckbox' || row.role === 'menuitemradio')
      && (row.checked === 'true' || row.checked === 'false' || row.checked === 'mixed'))
    && target.radioSelectionCounts.every((count) => count <= 1))
})

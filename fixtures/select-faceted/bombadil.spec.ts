import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForSelectFacetedFixture = registerCustomAction(
  'waitForSelectFacetedFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="select-faceted"]')) {
      if (Date.now() >= deadline) throw new Error('SelectFaceted fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="select-faceted"]')
  if (!root) return null

  const trigger = root.querySelector<HTMLElement>('[data-fixture-target]')
  const menu = trigger?.nextElementSibling as (HTMLElement & { isOpen: boolean }) | null
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
    disabled: trigger?.hasAttribute('disabled') ?? null,
    expanded: trigger?.getAttribute('aria-expanded') ?? null,
    menuIsOpen: menu?.isOpen ?? null,
    menuOpenState: menu?.matches(':state(open)') ?? null,
    mounted: trigger !== null,
    radioSelectionCounts,
    tabIndex: trigger?.tabIndex ?? null,
  }
})

export const selectFacetedReadyActions = actions(() => (
  fixture.current === null ? [waitForSelectFacetedFixture()] : []
))

export const selectFacetedOpenStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.mounted) return true

  return current.expanded === String(current.menuIsOpen)
    && current.menuOpenState === current.menuIsOpen
    && current.tabIndex === (current.disabled ? -1 : 0)
})

export const selectFacetedSelectionIndicatorsAreValid = always(() => {
  const current = fixture.current
  if (current === null || !current.mounted) return true

  return current.checkableRows.every((row: { checked: string | null; role: string | null }) =>
    (row.role === 'menuitemcheckbox' || row.role === 'menuitemradio')
      && (row.checked === 'true' || row.checked === 'false' || row.checked === 'mixed'))
    && current.radioSelectionCounts.every((count: number) => count <= 1)
})

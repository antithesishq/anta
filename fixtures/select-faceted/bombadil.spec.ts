import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

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

const setRootSearch = registerCustomAction(
  'selectFacetedSetRootSearch',
  async (document, window, query: string) => {
    const host = document.querySelector<HTMLElement>('[data-select-faceted-host]')
    const menu = host?.querySelector<HTMLElement & { isOpen: boolean }>(':scope > a-menu')
    const input = menu?.querySelector<HTMLElement & { value: string }>(':scope > a-select-header a-input[data-menu-search]')
    if (!menu?.isOpen || !input) return
    const browser = window as unknown as typeof globalThis
    input.value = query
    input.dispatchEvent(new browser.Event('input', { bubbles: true, composed: true }))
  },
)

const pressRootSearchKey = registerCustomAction(
  'selectFacetedPressRootSearchKey',
  async (document, window, key: string) => {
    const host = document.querySelector<HTMLElement>('[data-select-faceted-host]')
    const menu = host?.querySelector<HTMLElement & { isOpen: boolean }>(':scope > a-menu')
    const input = menu?.querySelector<HTMLElement>(':scope > a-select-header a-input[data-menu-search]')
    const control = input?.shadowRoot?.querySelector<HTMLElement>('input')
    if (!menu?.isOpen || !control) return
    const browser = window as unknown as typeof globalThis
    control.focus()
    control.dispatchEvent(new browser.KeyboardEvent('keydown', { key, code: key, bubbles: true, composed: true, cancelable: true }))
    control.dispatchEvent(new browser.KeyboardEvent('keyup', { key, code: key, bubbles: true, composed: true, cancelable: true }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="select-faceted"]')
  if (!root) return null

  const host = root.querySelector<HTMLElement>('[data-select-faceted-host]')
  const trigger = host?.querySelector<HTMLElement>(':scope > a-button') ?? null
  const menu = host?.querySelector<HTMLElement & { isOpen: boolean }>(':scope > a-menu') ?? null
  const search = menu?.querySelector<HTMLElement & { value: string }>(':scope > a-select-header a-input[data-menu-search]') ?? null
  const rows = menu
    ? Array.from(menu.querySelectorAll<HTMLElement>('a-menu-item[data-fixture-facet]'), (row) => ({
        checked: row.getAttribute('aria-checked'),
        facet: row.dataset.fixtureFacet ?? '',
        search: row.dataset.fixtureSearch ?? '',
        value: row.dataset.fixtureValue ?? '',
      }))
    : []

  return {
    actualDisabled: trigger?.hasAttribute('disabled') ?? null,
    actualMounted: host !== null,
    activeCountText: trigger?.querySelector('a-tag')?.textContent?.trim() ?? '',
    expectedActiveCount: Number(root.dataset.expectedActiveCount ?? '0'),
    expectedDisabled: root.dataset.expectedDisabled === 'true',
    expectedMounted: root.dataset.expectedMounted === 'true',
    expectedValue: JSON.parse(root.dataset.expectedValue ?? '{}') as Record<string, unknown>,
    expanded: trigger?.getAttribute('aria-expanded') ?? null,
    lastChangeValid: root.dataset.lastChangeValid === 'true',
    menuIsOpen: menu?.isOpen ?? null,
    menuOpenState: menu?.matches(':state(open)') ?? null,
    rows,
    searchQuery: search?.value ?? '',
  }
})

export const selectFacetedSearchActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || !current.menuIsOpen) return []
  return [
    ...['', 'ali', 'open', 'car', 'zzz'].map((query) => setRootSearch(query)),
    ...['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].map((key) => pressRootSearchKey(key)),
  ]
})

export const selectFacetedReadyActions = actions(() => (
  fixture.current === null ? [waitForSelectFacetedFixture()] : []
))

export const selectFacetedValueHasAValidShape = always(() => {
  const current = fixture.current
  if (current === null) return true
  if (current.actualMounted !== current.expectedMounted) return false
  if (!current.expectedMounted) return true

  const value = current.expectedValue
  const keys = Object.keys(value)
  const status = value.status
  const assignee = value.assignee
  return current.lastChangeValid
    && keys.every((key) => key === 'status' || key === 'assignee')
    && (status === undefined || ['open', 'in-progress', 'closed'].includes(status as string))
    && (assignee === undefined || (Array.isArray(assignee)
      && new Set(assignee).size === assignee.length
      && assignee.every((entry) => ['alice', 'bob', 'carol'].includes(entry as string))))
})

export const selectFacetedRowsMatchTheControlledValue = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  const status = current.expectedValue.status
  const assignees = Array.isArray(current.expectedValue.assignee) ? current.expectedValue.assignee : []

  return current.rows.every((row: { checked: string | null; facet: string; value: string }) => {
    const expected = row.facet === 'status' ? status === row.value : assignees.includes(row.value)
    return row.checked === String(expected)
  })
})

export const selectFacetedOpenStateAndCountStayCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  const expectedCountText = current.expectedActiveCount === 0 ? '' : String(current.expectedActiveCount)
  return current.actualDisabled === current.expectedDisabled
    && current.expanded === String(current.menuIsOpen)
    && current.menuOpenState === current.menuIsOpen
    && current.activeCountText === expectedCountText
})

export const selectFacetedSearchOnlyShowsMatches = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted || current.searchQuery.trim() === '') return true
  const query = current.searchQuery.trim().toLowerCase()
  return current.rows.length === 0
    || current.rows.every((row: { search: string }) => row.search.toLowerCase().includes(query))
})

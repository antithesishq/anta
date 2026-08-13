import { always } from '@antithesishq/bombadil'
import { actions, extract, getFingerprint, weighted } from '@antithesishq/bombadil/browser'

function clickablePoint(element: Element): { x: number; y: number } | null {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null
}
// Fails on browser errors or failed requests.
export { noConsoleErrors, noHttpErrorCodes, noUncaughtExceptions, noUnhandledPromiseRejections } from '@antithesishq/bombadil/browser/defaults'

const harness = extract((state) => {
  const api = (state.window as Window & { __antaButtonHarness?: { snapshot(): unknown } }).__antaButtonHarness
  return api?.snapshot() as any ?? null
})

const target = extract((state) => {
  const element = state.document.querySelector('[data-bombadil-target] a-button, [data-bombadil-target] a[role="button"]')
  const point = element ? clickablePoint(element) : null
  return element && point ? { fingerprint: getFingerprint(element), point } : null
})

const nextControl = extract((state) => {
  const element = state.document.querySelector('[data-harness-next]')
  const point = element ? clickablePoint(element) : null
  return element && point ? { fingerprint: getFingerprint(element), point } : null
})

// Renders exactly one actionable root.
export const renders_one_actionable_button = always(() =>
  harness.current !== null && harness.current.root.count === 1,
)

// Renders the root element required by its mode.
export const root_mode_matches_scenario = always(() => {
  if (!harness.current) return false
  const { behavior, root } = harness.current
  return behavior === 'href'
    ? root.tag === 'A' && root.role === 'button' && root.dataAnta
    : root.tag === 'A-BUTTON' && root.role === 'button'
})

// Disabled or loading Buttons are removed from tab order.
export const disabled_and_loading_are_unfocusable = always(() =>
  harness.current !== null &&
  (harness.current.disabled || harness.current.loading
    ? harness.current.root.tabIndex === -1 && harness.current.root.ariaDisabled === 'true'
    : harness.current.root.tabIndex === 0),
)

// Disabled or loading Buttons do not activate.
export const disabled_and_loading_never_activate = always(() => {
  if (!harness.current || (!harness.current.disabled && !harness.current.loading)) return true
  const events = harness.current.events
  return events.click === 0 && events.submit === 0 && events.submitDetailed === 0 &&
    events.reset === 0 && events.navigationPrevented === 0
})

// Link activations prevent harness navigation.
export const href_activations_prevent_navigation = always(() => {
  if (!harness.current || harness.current.behavior !== 'href') return true
  const { click, navigationPrevented } = harness.current.events
  return navigationPrevented === click
})

// Form type selects submit, reset, or no form action.
export const form_action_is_exclusive = always(() => {
  if (!harness.current || harness.current.behavior !== 'form') return true
  const { formType, events, formValue } = harness.current
  if (formType === 'button') return events.submit === 0 && events.submitDetailed === 0 && events.reset === 0
  if (formType === 'submit') return events.reset === 0
  return events.submit === 0 && events.submitDetailed === 0 && (events.reset === 0 || formValue === 'default')
})

// Icon-only Buttons have an accessible name.
export const icon_only_button_has_an_accessible_name = always(() =>
  harness.current?.contentKind !== 'icon-only' || Boolean(harness.current.root.ariaLabel?.trim()),
)

// Renders a visible, non-zero-sized Button.
export const rendered_button_is_visible = always(() => {
  const visual = harness.current?.root.visual
  return visual !== undefined &&
    visual.width > 0 &&
    visual.height > 0 &&
    visual.display !== 'none' &&
    visual.visibility !== 'hidden' &&
    visual.color !== 'rgba(0, 0, 0, 0)'
})

// Primary Buttons resolve a non-transparent background.
export const primary_button_has_painted_background = always(() => {
  if (!harness.current || harness.current.priority !== 'primary') return true
  const visual = harness.current.root.visual
  return visual.primaryBackgroundToken !== null &&
    visual.backgroundColor !== null &&
    visual.backgroundColor !== 'rgba(0, 0, 0, 0)'
})

// Exhaust the action set at the final corpus entry. Bombadil then ends this
// finite corpus run rather than repeatedly interacting with scenario 050.
const corpusComplete = () => harness.current?.complete === true

export const click_target = actions(() =>
  !corpusComplete() && target.current ? [{ Click: target.current }] : [],
)

export const press_enter = actions(() =>
  !corpusComplete() && target.current ? [{ Click: target.current }, { PressKey: { code: 13 } }] : [],
)

export const press_space = actions(() =>
  !corpusComplete() && target.current ? [{ Click: target.current }, { PressKey: { code: 32 } }] : [],
)

export const next_scenario = actions(() =>
  !corpusComplete() && nextControl.current ? [{ Click: nextControl.current }] : [],
)

// Advance often enough to traverse the finite 50-entry corpus within the
// ordinary one-minute budget, while retaining several activation attempts per
// scenario. The final entry exposes no Bombadil actions.
export const interactions = weighted([
  [3, click_target],
  [3, press_enter],
  [3, press_space],
  [2, next_scenario],
])

import { always, next } from '@antithesishq/bombadil'
import {
  actions,
  extract,
  getFingerprint,
  type Action,
  type ActionTemplate,
  type Fingerprint,
} from '@antithesishq/bombadil/browser'
import {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from '@antithesishq/bombadil/browser/defaults/properties'

export { noConsoleErrors, noHttpErrorCodes, noUncaughtExceptions, noUnhandledPromiseRejections }

type AnyElement = Element & Record<string, any>
type Point = { x: number; y: number }
type HarnessRuntime = {
  runId: string
  seed: number
  corpusId: number
  scenario: number
  total: number
  archetype: string
  compileStatus: string
  root: unknown
  tsx: string
  css: string
  telemetry: {
    interactions: number
    counts: Record<string, {
      clicks: number
      copyRequests: number
      copyResults: number
      stateChanges: number
      clearInputs: number
      inputChanges: number
    }>
    editFailures: number
    lastDialogOpener?: Record<string, string>
  }
}

function deepQuery(root: Element, selector: string): Element[] {
  const found: Element[] = []
  const visit = (element: Element) => {
    if (element.matches(selector)) found.push(element)
    if (element.shadowRoot) {
      for (const child of Array.from(element.shadowRoot.children)) visit(child)
      return
    }
    if (element instanceof HTMLSlotElement) {
      for (const assigned of element.assignedElements({ flatten: true })) visit(assigned)
      return
    }
    for (const child of Array.from(element.children)) visit(child)
  }
  visit(root)
  return found
}

function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement
  const root = element.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

function composedClosest(element: Element | null, predicate: (candidate: Element) => boolean): Element | null {
  for (let current = element; current; current = composedParent(current)) {
    if (predicate(current)) return current
  }
  return null
}

function composedContains(container: Element, element: Element | null): boolean {
  return composedClosest(element, (candidate) => candidate === container) != null
}

function deepActive(document: Document): Element | null {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

function ownerKey(element: Element | null): string | null {
  if (!element) return null
  const input = composedClosest(element, (candidate) => candidate.localName === 'a-input')
  if (input && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return `${input.getAttribute('data-testid') ?? 'input'}::field`
  }
  const text = composedClosest(element, (candidate) => candidate.localName === 'a-text')
  if (text && element instanceof HTMLButtonElement && element.classList.contains('expand-btn')) {
    return `${text.getAttribute('data-testid') ?? 'text'}::expand`
  }
  const button = composedClosest(element, (candidate) => candidate.localName === 'a-button')
  if (button?.getAttribute('data-custom-event') === 'clearrequest') {
    const host = composedClosest(button, (candidate) => candidate.localName === 'a-input')
    return `${host?.getAttribute('data-testid') ?? 'input'}::clear`
  }
  if (button?.getAttribute('data-custom-event') === 'closerequest') {
    const host = composedClosest(button, (candidate) => candidate.localName === 'a-dialog')
    return `${host?.getAttribute('data-testid') ?? 'dialog'}::close`
  }
  if (element instanceof HTMLDialogElement) {
    const host = composedClosest(element, (candidate) => candidate.localName === 'a-dialog')
    return `${host?.getAttribute('data-testid') ?? 'dialog'}::dialog`
  }
  return composedClosest(element, (candidate) => candidate.hasAttribute('data-testid'))?.getAttribute('data-testid') ?? null
}

function rendered(window: Window, element: Element): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  for (let current: Element | null = element; current; current = composedParent(current)) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
  }
  return true
}

function outlineVisible(window: Window, element: Element, pseudo?: string): boolean {
  const style = window.getComputedStyle(element, pseudo)
  return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth || '0') > 0
}

function countOf(
  counts: HarnessRuntime['telemetry']['counts'],
  id: string,
  field: keyof HarnessRuntime['telemetry']['counts'][string],
): number {
  return counts[id]?.[field] ?? 0
}

function clickPoint(element: AnyElement): Point | null {
  const customRect = element.localName === 'a-input' && typeof element.getAnchorRect === 'function'
    ? element.getAnchorRect()
    : element.getBoundingClientRect()
  if (customRect.width <= 0 || customRect.height <= 0) return null
  return { x: customRect.left + customRect.width / 2, y: customRect.top + customRect.height / 2 }
}

const harnessSnapshot = extract((state) => {
  const current = (state.window as Window & { __antaHarness?: { current?: HarnessRuntime } }).__antaHarness?.current
  if (!current) return null
  return {
    runId: current.runId,
    seed: current.seed,
    corpusId: current.corpusId,
    scenario: current.scenario,
    total: current.total,
    archetype: current.archetype,
    compileStatus: current.compileStatus,
    root: current.root as any,
    tsx: current.tsx,
    css: current.css,
    telemetry: current.telemetry,
  }
})

const focus = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  if (!preview) return { corpusId: -1, active: null, activeInPreview: false, rings: [] }
  const runtime = (state.window as Window & { __antaHarness?: { current?: HarnessRuntime } }).__antaHarness?.current
  const active = deepActive(state.document)
  const rings = new Set<string>()

  for (const element of deepQuery(preview, ':focus-visible')) {
    const key = ownerKey(element)
    if (key && rendered(state.window, element)) rings.add(key)
  }
  for (const input of deepQuery(preview, 'a-input')) {
    const field = input.shadowRoot?.querySelector('.field')
    if (field && rendered(state.window, field) && outlineVisible(state.window, field)) {
      const key = input.getAttribute('data-testid')
      if (key) rings.add(`${key}::field`)
    }
  }
  for (const check of deepQuery(preview, 'a-checkbox, a-radio')) {
    if (rendered(state.window, check) && outlineVisible(state.window, check, '::before')) {
      const key = ownerKey(check)
      if (key) rings.add(key)
    }
  }

  const inPreview = !!active && composedContains(preview, active)
  return {
    corpusId: runtime?.corpusId ?? -1,
    active: ownerKey(active),
    activeInPreview: inPreview,
    rings: [...rings],
  }
})

const behavior = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  const runtime = (state.window as Window & { __antaHarness?: { current?: HarnessRuntime } }).__antaHarness?.current
  if (!preview || !runtime) return { corpusId: -1, active: null, blocked: {}, counts: {} }
  const blocked: Record<string, boolean> = {}

  for (const element of deepQuery(preview, '[data-testid]')) {
    const id = element.getAttribute('data-testid')
    if (!id) continue
    const parentBlocked = !!element.closest('a-radio-group[disabled], a-tabs[disabled]')
    blocked[id] = element.hasAttribute('disabled') || element.hasAttribute('loading') || parentBlocked
  }

  return {
    corpusId: runtime.corpusId,
    active: ownerKey(deepActive(state.document)),
    blocked,
    counts: runtime.telemetry.counts,
  }
})

type RuntimeNode = {
  id?: string
  type?: string
  props?: Record<string, unknown>
  children?: RuntimeNode[]
  propNodes?: Record<string, RuntimeNode[]>
}

function generatedInputDefaults(root: unknown): Record<string, string> {
  const defaults: Record<string, string> = {}
  const visit = (node: RuntimeNode) => {
    if (node.type === 'Input' && node.id) defaults[node.id] = String(node.props?.defaultValue ?? '')
    for (const child of node.children ?? []) visit(child)
    for (const children of Object.values(node.propNodes ?? {})) {
      for (const child of children) visit(child)
    }
  }
  if (root && typeof root === 'object') visit(root as RuntimeNode)
  return defaults
}

const inputs = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  const runtime = (state.window as Window & { __antaHarness?: { current?: HarnessRuntime } }).__antaHarness?.current
  if (!preview || !runtime || runtime.compileStatus !== 'ready') return { valid: true, failures: [] }
  const defaults = generatedInputDefaults(runtime.root)
  const failures: string[] = []
  for (const input of deepQuery(preview, 'a-input')) {
    const id = input.getAttribute('data-testid') ?? 'unknown-input'
    const host = input as AnyElement
    const control = input.shadowRoot?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
    if (!control) {
      failures.push(`${id}: missing native input`)
      continue
    }
    const value = String(host.value ?? '')
    if (value !== control.value) failures.push(`${id}: public and native values differ`)
    const counts = runtime.telemetry.counts[id]
    const untouched = !counts || (counts.inputChanges === 0 && counts.clearInputs === 0)
    if (untouched && value !== (defaults[id] ?? '')) failures.push(`${id}: initial value differs from generated value`)
  }
  return { valid: failures.length === 0, failures }
})

const selections = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  if (!preview) return { valid: true, failures: [] }
  const failures: string[] = []

  for (const group of deepQuery(preview, 'a-radio-group, a-tabs')) {
    const node = group as AnyElement
    const id = group.getAttribute('data-testid') ?? group.localName
    const itemName = group.localName === 'a-tabs' ? 'a-tab' : 'a-radio'
    const items = Array.from(group.querySelectorAll(itemName)) as AnyElement[]
    const selected = items.filter((item) => !!item.selected)
    if (selected.length !== 1 || selected[0].getAttribute('value') !== String(node.value ?? '')) {
      failures.push(`${id}: selected item does not match group value`)
    }
  }

  return { valid: failures.length === 0, failures }
})

const tooltips = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  if (!preview) return { open: [] }
  const open = deepQuery(preview, 'a-tooltip')
    .filter((tooltip) => deepQuery(tooltip, ':popover-open').length > 0)
    .map((tooltip) => tooltip.getAttribute('data-testid') ?? ownerKey(tooltip.parentElement) ?? 'tooltip')
  return { open }
})

const actionTargets = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  if (!preview) return []
  const selectors = 'a-button, a-checkbox, a-radio, a-tab, a-input, a-card[href], button.expand-btn'
  const targets: Array<{ fingerprint: Fingerprint; point: Point }> = []
  const seen = new Set<Element>()
  for (const element of deepQuery(preview, selectors) as AnyElement[]) {
    if (seen.has(element) || !rendered(state.window, element)) continue
    const point = clickPoint(element)
    if (!point || point.x < 0 || point.y < 0 || point.x > state.window.innerWidth || point.y > state.window.innerHeight) continue
    targets.push({ fingerprint: getFingerprint(element), point })
    seen.add(element)
  }
  return targets
})

const activeInput = extract((state) => {
  const preview = state.document.querySelector('[data-compile-status]')
  const active = deepActive(state.document)
  if (!preview || !active || !composedContains(preview, active)) return false
  return (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && !active.disabled && !active.readOnly
})

const stageScroll = extract((state) => {
  const stage = state.document.querySelector('[data-compile-status]') as HTMLElement | null
  if (!stage) return null
  const rect = stage.getBoundingClientRect()
  if (stage.scrollHeight <= stage.clientHeight + 1 || rect.width <= 0 || rect.height <= 0) return null
  return {
    point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    down: Math.max(0, stage.scrollHeight - stage.clientHeight - stage.scrollTop),
    up: stage.scrollTop,
  }
})

const nextScenario = extract((state) => {
  const nextButton = state.document.querySelector('[data-testid="next-scenario"]') as AnyElement | null
  if (!nextButton || nextButton.hasAttribute('disabled')) return null
  const point = clickPoint(nextButton)
  return point ? { fingerprint: getFingerprint(nextButton), point } : null
})

const lastAction = extract((state) => state.lastAction)

function targetOf(action: Action | null, previousActive: string | null): string | null {
  if (!action || typeof action === 'string') return null
  if ('Click' in action) return action.Click.fingerprint.testId
  if ('PressKey' in action && (action.PressKey.code === 13 || action.PressKey.code === 32)) return previousActive
  return null
}

export const focusIndicatorIsSingular = always(() => focus.current.rings.length <= 1)

export const blockedControlsDoNotActivate = always(() => {
  const before = behavior.current
  return next(() => {
    if (behavior.current.corpusId !== before.corpusId) return true
    const action = lastAction.current
    const target = targetOf(action, before.active)
    if (!target || !before.blocked[target]) return true
    if (action && typeof action !== 'string' && 'PressKey' in action && ![13, 32].includes(action.PressKey.code)) return true
    return countOf(before.counts, target, 'clicks') === countOf(behavior.current.counts, target, 'clicks') &&
      countOf(before.counts, target, 'copyRequests') === countOf(behavior.current.counts, target, 'copyRequests') &&
      countOf(before.counts, target, 'copyResults') === countOf(behavior.current.counts, target, 'copyResults')
  })
})

export const inputValuesReflectState = always(() => inputs.current.valid)

export const selectionMatchesGroupValue = always(() => selections.current.valid)

export const tooltipIsExclusive = always(() => tooltips.current.open.length <= 1)

function weightedGroups(groups: Array<{ weight: number; values: ActionTemplate[] }>) {
  return {
    branches: groups
      .filter((group) => group.values.length > 0)
      .map((group) => [group.weight, {
        branches: group.values.map((value) => [1, { value }] as [number, { value: ActionTemplate }]),
      }] as [number, { branches: Array<[number, { value: ActionTemplate }]> }]),
  }
}

export const exploreHarness = actions(() => {
  const snapshot = harnessSnapshot.current
  if (!snapshot || snapshot.compileStatus !== 'ready') return ['Wait']

  const interactions = snapshot.telemetry.interactions
  const next = nextScenario.current
  if (next && interactions >= 30) return [{ Click: next }]

  const clickActions: ActionTemplate[] = actionTargets.current.map((target) => ({ Click: target }))
  const keyboardValues: ActionTemplate[] = focus.current.activeInPreview
    ? [
        { PressKey: { code: 9 } },
        { PressKey: { code: 9 } },
        { PressKey: { code: 9 } },
        { PressKey: { code: 13 } },
        { PressKey: { code: 32 } },
        { PressKey: { code: 27 } },
        { PressKey: { code: 35 } },
        { PressKey: { code: 36 } },
        { PressKey: { code: 37 } },
        { PressKey: { code: 38 } },
        { PressKey: { code: 39 } },
        { PressKey: { code: 40 } },
      ]
    : [{ PressKey: { code: 9 } }]
  const textValues: ActionTemplate[] = activeInput.current
    ? [{
        TypeText: {
          text: {
            CharSet: [
              { Range: [32, 126] },
              { Literal: '🙂' },
              { Literal: 'مرحبا' },
              { Literal: 'é' },
            ],
          },
          delayMillis: [1, 30],
        },
      }]
    : []
  const viewportValues: ActionTemplate[] = [{ SetViewport: { width: [320, 1440], height: [480, 1000] } }]
  const scroll = stageScroll.current
  const scrollValues: ActionTemplate[] = scroll
    ? [
        ...(scroll.down > 0 ? [{ ScrollDown: { origin: scroll.point, distance: [1, Math.max(1, Math.round(scroll.down))] } } as ActionTemplate] : []),
        ...(scroll.up > 0 ? [{ ScrollUp: { origin: scroll.point, distance: [1, Math.max(1, Math.round(scroll.up))] } } as ActionTemplate] : []),
      ]
    : []
  const nextValues: ActionTemplate[] = next && interactions >= 12 ? [{ Click: next }] : []

  return weightedGroups([
    { weight: 40, values: clickActions },
    { weight: 25, values: keyboardValues },
    { weight: 20, values: textValues },
    { weight: 7, values: viewportValues },
    { weight: 5, values: scrollValues },
    { weight: 3, values: ['Wait'] },
    { weight: 10, values: nextValues },
  ])
})

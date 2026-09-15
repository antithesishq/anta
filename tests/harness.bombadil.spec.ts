import { actions, extract, getFingerprint, type ActionTemplate, type Fingerprint, type Point } from '@antithesishq/bombadil/browser'

export {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from '@antithesishq/bombadil/browser/defaults'

type ActionTarget = {
  fingerprint: Fingerprint
  point: Point
}

const previewTargets = extract((state) => {
  const preview = state.document.querySelector<HTMLElement>('[data-compile-status]')
  if (!preview) return []

  const targetFor = (element: HTMLElement): ActionTarget[] => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []

    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    if (point.x < 0 || point.y < 0 || point.x > state.window.innerWidth || point.y > state.window.innerHeight) return []

    return [{ fingerprint: getFingerprint(element), point }]
  }

  const targets = [...preview.querySelectorAll<HTMLElement>('a-button, a-checkbox, a-radio, a-tab, a-input, a-card[href], button, input, textarea, select')]
    .flatMap((element): ActionTarget[] => {
      return targetFor(element)
    })

  return targets.length ? targets : targetFor(preview)
})

export const explorePreview = actions((): ActionTemplate[] => {
  return previewTargets.current.map((target) => ({ Click: target }))
})

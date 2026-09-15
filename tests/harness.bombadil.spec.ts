import { actions, extract, getFingerprint, type ActionTemplate } from '@antithesishq/bombadil/browser'

export {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from '@antithesishq/bombadil/browser/defaults'

const previewTargets = extract((state) => {
  const preview = state.document.querySelector<HTMLElement>('[data-compile-status]')
  if (!preview) return []

  const click = (element: HTMLElement): ActionTemplate[] => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []

    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    if (point.x < 0 || point.y < 0 || point.x > state.window.innerWidth || point.y > state.window.innerHeight) return []

    return [{ Click: { fingerprint: getFingerprint(element), point } }]
  }

  const controls = preview.querySelectorAll<HTMLElement>(
    ':is(a[href], button, input, textarea, select, [role="button"], [role="checkbox"], [role="radio"], [role="tab"], [role="textbox"], [role="combobox"])',
  )
  const targets = [...controls].flatMap(click)

  // Keep generating preview-only actions while the initial render is pending.
  return targets.length ? targets : click(preview)
})

export const explorePreview = actions((): ActionTemplate[] => {
  return previewTargets.current
})

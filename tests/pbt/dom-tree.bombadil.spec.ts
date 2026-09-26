import { actions, extract, getFingerprint, type ActionTemplate } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'

const previewTarget = extract((state) => {
  const preview = state.document.querySelector<HTMLElement>('[data-compile-status]')
  if (!preview) return null

  const rect = preview.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  if (point.x < 0 || point.y < 0 || point.x > state.window.innerWidth || point.y > state.window.innerHeight) return null

  return { fingerprint: getFingerprint(preview), point }
})

export const clickPreview = actions((): ActionTemplate[] => {
  const target = previewTarget.current
  return target ? [{ Click: target }] : []
})

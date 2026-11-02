import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Dialog'

const dialog = extract(state => {
  const record = state.window.__antaDialog
  if (!record) return null
  const root = state.document.getElementById(record.id)!
  const host = root.querySelector('a-dialog')!
  const native = host.shadowRoot!.querySelector('dialog')!
  const rect = (element: Element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return { left, right, top, bottom }
  }
  const close = host.querySelector('a-dialog-close a-button')
  return {
    ...record,
    state: host.getAttribute('state'),
    nativeOpen: native.open,
    persistent: host.hasAttribute('persistent'),
    close: close ? rect(close) : null,
    done: rect(host.querySelector('[slot="footer"] a-button')!),
    bounds: rect(native),
  }
})

function contains(rect: { left: number; right: number; top: number; bottom: number }, point: { x: number; y: number }) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

export const dialogOpenStatesAgree = always(() => {
  const current = dialog.current
  return !current || (current.state === (current.open ? 'open' : 'closed') && current.nativeOpen === current.open)
})

export const dialogDismissalFollowsPersistent = always(() => {
  const before = dialog.current
  if (!before?.open) return true
  return next(() => {
    const after = dialog.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    const escape = 'PressKey' in action && action.PressKey.code === 27
    const backdrop = 'Click' in action && !contains(before.bounds, action.Click.point)
    return !(escape || backdrop) || after.open === before.persistent
  })
})

export const dialogExplicitCloseWorks = always(() => {
  const before = dialog.current
  if (!before) return true
  if (!!before.close !== before.closable) return false
  return next(() => {
    const after = dialog.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!before.open || !action || typeof action !== 'object' || !('Click' in action)) return true
    const point = action.Click.point
    const clickedClose = (before.close && contains(before.close, point)) || contains(before.done, point)
    return !clickedClose || !after.open
  })
})

export const dialogUnrelatedActionsPreserveOpen = always(() => {
  const before = dialog.current
  if (!before) return true
  return next(() => {
    const after = dialog.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    const advance = 'Custom' in action && action.Custom.name === 'advanceAppFixture'
    return !(advance || 'ScrollUp' in action || 'ScrollDown' in action) || after.open === before.open
  })
})

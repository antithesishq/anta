import { actions, extract, getFingerprint } from '@antithesishq/bombadil/browser'
import type {} from './Dialog'

const target = extract(state => {
  const record = state.window.__antaDialog
  if (!record?.open) return null
  const host = state.document.getElementById(record.id)!.querySelector('a-dialog')!
  const rect = host.shadowRoot!.querySelector('dialog')!.getBoundingClientRect()
  const point = { x: 1, y: 1 }
  return { fingerprint: getFingerprint(host), point, outside: point.x < rect.left || point.y < rect.top }
})

export const dialogDismissal = actions(() => {
  const current = target.current
  if (!current) return []
  return [
    { PressKey: { code: 27 } },
    ...(current.outside ? [{ Click: { fingerprint: current.fingerprint, point: current.point } }] : []),
  ]
})

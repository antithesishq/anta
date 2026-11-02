import { actions, extract, getFingerprint } from '@antithesishq/bombadil/browser'
import type {} from './Select'

const options = extract(state => {
  const record = state.window.__antaSelect
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return []
  const menu = state.document.getElementById(record.id)!.querySelector('a-menu')! as HTMLElement & { isOpen: boolean }
  if (!menu.isOpen) return []
  return Array.from(menu.querySelectorAll('[data-testid]')).flatMap(option => {
    const rect = option.getBoundingClientRect()
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    return option.checkVisibility() && point.x >= 0 && point.x < state.window.innerWidth
      && point.y >= 0 && point.y < state.window.innerHeight
      ? [{ fingerprint: getFingerprint(option), point }] : []
  })
})

export const selectOptions = actions(() => options.current.map(option => ({ Click: option })))

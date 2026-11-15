import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Checkbox'

const target = extract(state => {
  const record = state.window.__antaCheckbox
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  return {
    focused: state.document.activeElement?.id === record.id,
    disabled: record.requestedDisabled,
  }
})

const focusCheckbox = registerCustomAction('focusCheckbox', async (document, window) => {
  document.getElementById(window.__antaCheckbox!.id)!.focus()
})

export const checkboxKeyboard = actions(() => {
  const current = target.current
  if (!current) return []
  const tab = { PressKey: { code: 9 } }
  if (current.focused) return [{ PressKey: { code: 32 } }, tab]
  return current.disabled ? [tab] : [focusCheckbox()]
})

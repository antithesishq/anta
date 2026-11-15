import { always } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'

const submission = extract(state => {
  const form = state.document.querySelector<HTMLFormElement>('[data-fixture-form]')
  if (!form) return null
  const disabledNames = Array.from(form.querySelectorAll(
    '[name][disabled], [data-fixture-submission-name][disabled]',
  ), control => control.getAttribute('name') ?? control.getAttribute('data-fixture-submission-name')!)
  return {
    disabledNames,
    submittedNames: Array.from(new FormData(form).keys()),
  }
})

export const disabledControlsAreExcludedFromSubmission = always(() => {
  const current = submission.current
  return !current || current.disabledNames.every(name => !current.submittedNames.includes(name))
})

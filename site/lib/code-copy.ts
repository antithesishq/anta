// One delegated handler covers authored and streamed Expressive Code blocks.
// Capture prevents EC's per-button handlers from copying the same text twice.
document.addEventListener('click', (event) => {
  const button = (event.target as Element)?.closest?.<HTMLButtonElement>('.expressive-code .copy button')
  if (!button) return
  event.stopImmediatePropagation()
  const code = button.dataset.code?.replace(/\u007f/g, '\n')
  if (code === undefined) return
  void navigator.clipboard.writeText(code).then(() => {
    button.dataset.antaCopied = 'true'
    const feedback = button.parentElement?.querySelector('[aria-live]')
    if (feedback) feedback.textContent = button.dataset.copied || 'Copied!'
    setTimeout(() => {
      delete button.dataset.antaCopied
      if (feedback) feedback.textContent = ''
    }, 1400)
  }).catch(() => {})
}, true)

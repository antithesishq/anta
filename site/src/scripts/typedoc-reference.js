const reviewMessage = 'Documentation has not yet been reviewed by a human.'

for (const tag of document.querySelectorAll('code.tsd-tag')) {
  if (tag.textContent?.trim().toLowerCase() !== 'unreviewed') continue
  tag.textContent = '✦'
  tag.classList.add('doc-review-marker')
  tag.tabIndex = 0
  tag.setAttribute('aria-label', reviewMessage)
  tag.dataset.reviewTooltip = reviewMessage
}

const toolbar = document.querySelector('.tsd-page-toolbar .tsd-toolbar-contents')
if (toolbar) {
  const link = document.createElement('a')
  link.href = '/'
  link.className = 'anta-docs-link'
  link.textContent = '← Anta docs'
  toolbar.prepend(link)
}

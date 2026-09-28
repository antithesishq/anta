const reviewMessage = 'Documentation has not yet been reviewed by a human.'

for (const tag of document.querySelectorAll('code.tsd-tag')) {
  if (tag.textContent?.trim().toLowerCase() !== 'unreviewed') continue
  const marker = document.createElement('span')
  marker.className = 'doc-review-marker'
  marker.textContent = '✦'
  marker.tabIndex = 0
  marker.setAttribute('aria-label', reviewMessage)
  marker.dataset.reviewTooltip = reviewMessage
  tag.replaceWith(marker)
}

const toolbar = document.querySelector('.tsd-page-toolbar .tsd-toolbar-contents')
if (toolbar) {
  const link = document.createElement('a')
  link.href = '/'
  link.className = 'anta-docs-link'
  link.textContent = '← Anta docs'
  toolbar.prepend(link)
}

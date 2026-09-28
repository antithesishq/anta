// TypeDoc owns the search and theme controls. Anta only styles their native UI.
const root = document.documentElement
const preference = matchMedia('(prefers-color-scheme: dark)')

try {
  const siteTheme = localStorage.getItem('anta-theme')
  if (!localStorage.getItem('tsd-theme') && (siteTheme === 'light' || siteTheme === 'dark')) {
    localStorage.setItem('tsd-theme', siteTheme)
    root.dataset.theme = siteTheme
  }
} catch {}

const syncTheme = () => {
  const selected = root.dataset.theme || 'os'
  root.classList.toggle('dark', selected === 'dark' || (selected === 'os' && preference.matches))
}

syncTheme()
new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
preference.addEventListener('change', syncTheme)

for (const selector of ['#tsd-search-trigger', '#tsd-search-input', '#tsd-theme']) {
  document.querySelector(selector)?.setAttribute('data-anta', '')
}

// Match the docs site's search shortcut on macOS; TypeDoc already handles / and Ctrl+K.
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'k' || !event.metaKey || event.altKey || event.shiftKey) return
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
  event.preventDefault()
  document.getElementById('tsd-search-trigger')?.click()
})

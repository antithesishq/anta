// Keep TypeDoc's native search, visibility filters, and theme persistence.
(() => {
const root = document.documentElement
const preference = matchMedia('(prefers-color-scheme: dark)')
let themeToggle

try {
  const siteTheme = localStorage.getItem('anta-theme')
  if (!localStorage.getItem('tsd-theme') && (siteTheme === 'light' || siteTheme === 'dark')) {
    localStorage.setItem('tsd-theme', siteTheme)
    root.dataset.theme = siteTheme
  }
} catch {}

const syncTheme = () => {
  const selected = root.dataset.theme || 'os'
  const dark = selected === 'dark' || (selected === 'os' && preference.matches)
  root.classList.toggle('dark', dark)
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
    themeToggle.setAttribute('aria-pressed', String(dark))
  }
}

syncTheme()
new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
preference.addEventListener('change', syncTheme)

for (const selector of ['#tsd-search-trigger', '#tsd-search-input']) {
  document.querySelector(selector)?.setAttribute('data-anta', '')
}

const toolbar = document.querySelector('.tsd-toolbar-contents')
const visibility = document.querySelector('.tsd-filter-visibility')
const themeSelect = document.querySelector('#tsd-theme')
const nativeTheme = themeSelect?.closest('.tsd-theme-toggle')
const settings = document.querySelector('.tsd-navigation.settings')

if (toolbar && visibility && themeSelect && nativeTheme && settings) {
  const menu = document.createElement('details')
  menu.className = 'anta-visibility-menu'
  const trigger = document.createElement('summary')
  trigger.setAttribute('aria-label', 'Member visibility')
  const filterIcon = document.createElement('a-icon')
  filterIcon.setAttribute('shape', 'filter')
  filterIcon.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.className = 'anta-control-label'
  label.textContent = 'Visibility'
  const chevron = document.createElement('a-icon')
  chevron.setAttribute('shape', 'chevron-down')
  chevron.setAttribute('aria-hidden', 'true')
  trigger.append(filterIcon, label, chevron)
  const panel = document.createElement('div')
  panel.className = 'anta-visibility-panel'
  panel.append(visibility)
  menu.append(trigger, panel)
  toolbar.append(menu)

  themeToggle = document.createElement('button')
  themeToggle.type = 'button'
  themeToggle.className = 'anta-theme-toggle'
  themeToggle.setAttribute('data-anta', '')
  for (const shape of ['sun', 'moon']) {
    const icon = document.createElement('a-icon')
    icon.setAttribute('shape', shape)
    icon.setAttribute('aria-hidden', 'true')
    themeToggle.append(icon)
  }
  themeToggle.addEventListener('click', () => {
    const next = root.classList.contains('dark') ? 'light' : 'dark'
    themeSelect.value = next
    themeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    try { localStorage.setItem('anta-theme', next) } catch {}
    syncTheme()
  })
  toolbar.append(themeToggle)

  nativeTheme.classList.add('anta-native-theme')
  toolbar.append(nativeTheme)
  settings.remove()
  syncTheme()

  document.addEventListener('pointerdown', (event) => {
    if (!menu.contains(event.target)) menu.open = false
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false
      trigger.focus()
    }
  })
}

// Match the docs site's search shortcut on macOS; TypeDoc already handles / and Ctrl+K.
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'k' || !event.metaKey || event.altKey || event.shiftKey) return
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
  event.preventDefault()
  document.getElementById('tsd-search-trigger')?.click()
})
})()

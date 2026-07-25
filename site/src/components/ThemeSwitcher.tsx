import { useEffect, useState } from 'preact/hooks'
import { Select } from '@antadesign/anta'

/**
 * Sidebar palette switcher. Anta's default colors are seed-derived (generative);
 * picking "Anta" loads `/theme-anta.css` to restore the hand-tuned palette.
 * The choice persists in localStorage under `anta-palette`, and a no-flash inline
 * script in DocsLayout.astro applies it before paint (this island only reflects
 * the current value in the dropdown and handles changes).
 */
const KEY = 'anta-palette'
const LINK_ID = 'anta-palette-link'
const HREF = '/theme-anta.css'

// Announce a palette change so live token readouts (e.g. the Colors page
// swatches) can re-read their computed values — CSS repaints on its own, but
// JS that snapshotted a value needs the nudge.
const notify = () => window.dispatchEvent(new Event('anta-palette-change'))

function applyPalette(v: string) {
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (v === 'anta') {
    if (existing) {
      notify()
    } else {
      const link = document.createElement('link')
      link.id = LINK_ID
      link.rel = 'stylesheet'
      link.href = HREF
      // Wait for the stylesheet to apply before re-reading computed values.
      link.addEventListener('load', notify, { once: true })
      document.head.appendChild(link)
    }
  } else {
    existing?.remove() // removal is synchronous
    notify()
  }
}

export default function ThemeSwitcher() {
  const [value, setValue] = useState('none')

  // Reflect the stored choice once mounted (the inline head script already
  // applied the stylesheet before paint).
  useEffect(() => {
    setValue(localStorage.getItem(KEY) === 'anta' ? 'anta' : 'none')
  }, [])

  return (
    <Select
      size="small"
      leading="Theme:"
      value={value}
      onValueChange={(v: string) => {
        setValue(v)
        try {
          localStorage.setItem(KEY, v)
        } catch {
          // storage blocked (private mode) — apply for the session anyway
        }
        applyPalette(v)
      }}
      options={[
        { value: 'none', label: 'Default' },
        { value: 'anta', label: 'Anta' },
      ]}
    />
  )
}

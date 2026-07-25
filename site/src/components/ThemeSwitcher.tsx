import { useEffect, useState } from 'preact/hooks'
import { Select } from '@antadesign/anta'

/**
 * Sidebar palette switcher. Switching a theme swaps the href of the stable
 * palette <link> that DocsLayout.astro renders on every page (persisted across
 * ClientRouter swaps). The choice lives in localStorage under `anta-palette`;
 * DocsLayout's inline head script applies it before paint on cold loads, so
 * this island only reflects the value and handles changes.
 */
const KEY = 'anta-palette'
const LINK_ID = 'palette-link'
// Stored value → stylesheet URL. A new theme is a file under public/themes/
// plus entries here, in the options below, and in DocsLayout's inline script.
const THEME_HREF: Record<string, string> = {
  none: '/themes/default.css',
  anta: '/themes/anta.css',
}

// Announce a palette change so live token readouts (e.g. the Colors page
// swatches) can re-read their computed values — CSS repaints on its own, but
// JS that snapshotted a value needs the nudge.
const notify = () => window.dispatchEvent(new Event('anta-palette-change'))

function applyPalette(v: string) {
  const link = document.getElementById(LINK_ID) as HTMLLinkElement | null
  const href = THEME_HREF[v] ?? THEME_HREF.none
  if (!link || link.getAttribute('href') === href) {
    notify()
    return
  }
  // Wait for the stylesheet to apply before re-reading computed values.
  link.addEventListener('load', notify, { once: true })
  link.href = href
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
        { value: 'anta', label: 'Anta', tooltip: 'Hand-tuned default colors ("invisible" to non-designers)' },
      ]}
    />
  )
}

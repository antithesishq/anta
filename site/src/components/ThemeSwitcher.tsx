import { useEffect, useState } from 'preact/hooks'
import { Select } from '@antadesign/anta'

/**
 * Sidebar palette switcher. Anta's default colors are seed-derived (generative);
 * picking "Anta" points the palette <link> at `/themes/anta.css` to restore the
 * hand-tuned palette. The link itself is a stable element rendered by
 * DocsLayout.astro on every page (persisted across ClientRouter swaps via
 * `data-astro-transition-persist="palette"`); switching a theme only swaps its
 * href. The choice persists in localStorage under `anta-palette`, and a
 * no-flash inline script in DocsLayout.astro applies it before paint (this
 * island only reflects the current value in the dropdown and handles changes).
 */
const KEY = 'anta-palette'
const LINK_ID = 'palette-link'
// Stored value → stylesheet URL. Future themes are new files under
// site/public/themes/ plus an entry here and in the options below. Keep in
// sync with the inline palette script in DocsLayout.astro.
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

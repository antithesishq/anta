import { useEffect, useState } from 'preact/hooks'
import { Tabs } from '@antadesign/anta'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'critical' | 'warning'

const TONES: { value: Tone; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'brand', label: 'Brand' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
]

const isTone = (v: string | null): v is Tone => TONES.some((t) => t.value === v)

/**
 * Tone switcher for the Colors page. All six tones live on the one page and
 * picking a tab is pure client state: the SwatchGrid islands listen for the
 * `anta-colors-tone` event and re-render their token names in place, so a
 * switch never navigates and never moves the scroll position. The choice is
 * mirrored into the URL (`/colors/?tone=brand`) with replaceState so a tone
 * stays shareable; the mount effect applies an incoming `?tone=` deep link.
 * (A mount effect, not the useState initializer — the island is SSR'd and
 * Preact skips attribute patching during hydration; see site/CLAUDE.md.)
 */
export default function ToneTabs() {
  const [tone, setTone] = useState<Tone>('neutral')

  const apply = (next: Tone) => {
    setTone(next)
    window.dispatchEvent(new CustomEvent('anta-colors-tone', { detail: { tone: next } }))
    history.replaceState(null, '', next === 'neutral' ? '/colors/' : `/colors/?tone=${next}`)
  }

  useEffect(() => {
    const fromUrl = new URL(window.location.href).searchParams.get('tone')
    if (isTone(fromUrl) && fromUrl !== 'neutral') apply(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Tabs
      value={tone}
      label="Colour tones"
      options={TONES}
      onStateChange={(_event, { next }: { next: string | null }) => {
        if (next && next !== tone) apply(next as Tone)
      }}
    />
  )
}

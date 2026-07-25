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
 * Tone switcher for the Colors page. Picking a tab is client state: the
 * SwatchGrid islands listen for `anta-colors-tone` and re-render in place, so
 * a switch never navigates or scrolls. The tone mirrors into the URL
 * (`?tone=brand`) via replaceState, and a `?tone=` deep link applies in the
 * mount effect (not the useState initializer: Preact skips attribute patching
 * during hydration; see site/CLAUDE.md).
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

import { useMemo, useState } from 'preact/hooks'
import { Button, Input, Tabs } from '@antadesign/anta'
import * as Stickers from '@antadesign/stickers'

// Pull the bare names from the barrel by stripping the `Sticker` prefix
// from each `Sticker{Name}` export. Filter out the `Sticker{Name}Animated`
// variants — they're separate exports referencing the same name — and the
// bare `Sticker` / `StickerAnimated` base wrappers the package also exports.
const NAMES = Object.keys(Stickers)
  .filter(
    (k) => k.startsWith('Sticker') && k.length > 'Sticker'.length && !k.endsWith('Animated'),
  )
  .map((k) => k.slice('Sticker'.length))
  .sort()

function exportKey(pascal: string, animated: boolean) {
  return animated ? `Sticker${pascal}Animated` : `Sticker${pascal}`
}

const MODES = [
  { id: 'static', label: 'Static' },
  { id: 'animated', label: 'Animated' },
] as const

export default function StickerDemo() {
  const [mode, setMode] = useState<'animated' | 'static'>('static')
  const [paused, setPaused] = useState<boolean | number>(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAMES
    return NAMES.filter((n) => n.toLowerCase().includes(q))
  }, [query])

  return (
    <div class="full-bleed">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 960, margin: '0 auto 16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs
            options={MODES.map((m) => ({ value: m.id, label: m.label }))}
            value={mode}
            onValueChange={(_e, { value }) => { if (value) setMode(value as 'animated' | 'static') }}
            aria-label="Sticker variant"
          />
          {mode === 'animated' && (
            <div style={{ display: 'flex' }}>
              <Button priority="tertiary" tone="brand" icon="circle-play" label="Play all" onClick={() => setPaused(false)} />
              <Button priority="tertiary" tone="brand" icon="circle-pause" label="Pause all" onClick={() => setPaused(true)} />
              <Button priority="tertiary" tone="brand" icon="octagon-pause" label="Freeze at 1s" onClick={() => setPaused(1)} />
            </div>
          )}
        </div>
        <Input
          type="search"
          value={query}
          onValueChange={(_e, { value }) => setQuery(value)}
          placeholder={`Search ${NAMES.length} stickers…`}
          aria-label="Search stickers"
          style={{ width: '100%' }}
        />
      </div>
      {filtered.length === 0 ? (
        <p class="demoLabel" style={{ padding: '24px 0' }}>No stickers match “{query}”.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 174px)',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          {filtered.map((pascal) => {
            const Cmp = (Stickers as Record<string, (p: any) => any>)[exportKey(pascal, mode === 'animated')]
            if (!Cmp) return null
            const props = mode === 'animated'
              ? { size: 174, paused, label: pascal }
              : { size: 174, label: pascal }
            return (
              <div key={pascal} class="copyable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Cmp {...props} />
                <span class="demoLabel">{pascal}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState } from 'preact/hooks'
import { Card, Button, Checkbox } from '@antadesign/anta'
import ColorPicker from './ColorPicker'

/**
 * Theming-lab harness: compares the hand-tuned brand (`tone="brand"`, today's
 * shipped literals) against the generative derivation from a source color
 * (`tone={seed}`, which routes through the existing custom-tone oklch formula).
 *
 * No package CSS changes and no `:root` writes — the source color is passed as
 * the per-element `tone` prop, so the experiment is fully scoped and can't leak
 * into the rest of the site. At `#5f4bc3` the two columns should be
 * indistinguishable (the tuning check); move the picker and only the generative
 * side follows.
 */

const labelStyle = {
  margin: '0 0 12px',
  fontSize: 13,
  color: 'var(--text-3)',
  fontFamily: 'var(--sans-serif)',
}

function BrandCard({ tone, cardTone }: { tone: string; cardTone: string }) {
  return (
    <Card
      tone={cardTone}
      priority="primary"
      icon="book-open"
      header="Deployment ready"
      subtitle="Build #1284 · main"
      footer={
        <>
          <Button priority="primary" tone={tone} label="Deploy" />
          <Button priority="secondary" tone={tone} label="Preview" />
          <Button priority="tertiary" tone={tone} label="Logs" />
          <Button priority="quaternary" tone={tone} label="Docs" />
        </>
      }
    >
      Your build passed every check and is ready to ship to production.
    </Card>
  )
}

export default function BrandComparison() {
  const [seed, setSeed] = useState('#5f4bc3')
  const [deriveCard, setDeriveCard] = useState(false)

  const derivedCardTone = deriveCard ? seed : 'brand'

  const columns = (dark: boolean) => (
    <div
      className={dark ? 'dark' : 'light'}
      style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        borderRadius: 12,
        background: 'var(--bg-2)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 280px', minWidth: 280 }}>
        <p style={labelStyle}>
          Anta theme · hand-tuned <code>tone="brand"</code>
        </p>
        <BrandCard tone="brand" cardTone="brand" />
      </div>
      <div style={{ flex: '1 1 280px', minWidth: 280 }}>
        <p style={labelStyle}>
          Generative · <code>tone={'{seed}'}</code>
        </p>
        <BrandCard tone={seed} cardTone={derivedCardTone} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <ColorPicker value={seed} onChange={setSeed} />
        <Checkbox
          checked={deriveCard}
          onStateChange={(_e, { next }) => setDeriveCard(next === true)}
          label="Also derive the card surface"
        />
      </div>
      {columns(false)}
      {columns(true)}
    </div>
  )
}

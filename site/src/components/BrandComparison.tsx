import { useState } from 'preact/hooks'
import { Card, Button, Checkbox, Input } from '@antadesign/anta'
import ColorPicker from './ColorPicker'

/**
 * Theming-lab harness: compares the hand-tuned brand (`tone="brand"`, today's
 * shipped literals) against the generative derivation from a source color
 * (`tone={seed}`, which routes through the existing custom-tone oklch formula).
 *
 * The formula constants (the `--_tone-*` lightness / chroma / alpha stops the
 * button's custom-tone branch reads) are exposed as number inputs and applied
 * inline on the generative buttons, so you're tuning the *real* CSS formula —
 * not a JS reimplementation. The live formula is printed below the inputs.
 *
 * No package CSS changes and no `:root` writes: the source color and the
 * `--_tone-*` overrides are set per element, so nothing leaks into the site.
 */

// Formula constants → the CSS custom properties the button reads. Defaults
// mirror a-button.css's light custom-tone block.
const CONSTS = {
  plRest: '0.5',
  plHover: '0.45',
  plActive: '0.4',
  fgL: '0.46',
  fgStrongL: '0.4',
  fgC: '0.17',
  fgShift: '0.05',
  bgL: '0.54',
  bgC: '0.16',
  aRest: '0.1',
  aHover: '0.15',
  aActive: '0.2',
}
type Consts = typeof CONSTS

const VAR_OF: Record<keyof Consts, string> = {
  plRest: '--_tone-primary-l-rest',
  plHover: '--_tone-primary-l-hover',
  plActive: '--_tone-primary-l-active',
  fgL: '--_tone-fg-l',
  fgStrongL: '--_tone-fg-strong-l',
  fgC: '--_tone-fg-c',
  fgShift: '--button-fg-secondary-l-shift',
  bgL: '--_tone-bg-l',
  bgC: '--_tone-bg-c',
  aRest: '--_tone-bg-a-rest',
  aHover: '--_tone-bg-a-hover',
  aActive: '--_tone-bg-a-active',
}

const GROUPS: { title: string; keys: [keyof Consts, string][] }[] = [
  { title: 'Primary bg — lightness', keys: [['plRest', 'rest'], ['plHover', 'hover'], ['plActive', 'active']] },
  { title: 'Foreground', keys: [['fgL', 'L'], ['fgStrongL', 'L hover'], ['fgC', 'C'], ['fgShift', 'l-shift']] },
  { title: 'Secondary / tertiary bg', keys: [['bgL', 'L'], ['bgC', 'C'], ['aRest', 'α rest'], ['aHover', 'α hover'], ['aActive', 'α active']] },
]

const labelStyle = { margin: '0 0 12px', fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--sans-serif)' }

function BrandCard({ tone, cardTone, btnStyle }: { tone: string; cardTone: string; btnStyle?: Record<string, string> }) {
  const s = btnStyle as React.CSSProperties | undefined
  return (
    <Card tone={cardTone} priority="primary" icon="book-open" header="Deployment ready" subtitle="Build #1284 · main"
      footer={
        <>
          <Button priority="primary" tone={tone} label="Deploy" style={s} />
          <Button priority="secondary" tone={tone} label="Preview" style={s} />
          <Button priority="tertiary" tone={tone} label="Logs" style={s} />
          <Button priority="quaternary" tone={tone} label="Docs" style={s} />
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
  const [k, setK] = useState<Consts>(CONSTS)

  const set = (key: keyof Consts, v: string) => setK((p) => ({ ...p, [key]: v }))

  // The inline formula-constant overrides applied to the generative buttons.
  const toneVars: Record<string, string> = {}
  ;(Object.keys(VAR_OF) as (keyof Consts)[]).forEach((key) => {
    toneVars[VAR_OF[key]] = k[key]
  })

  const derivedCardTone = deriveCard ? seed : 'brand'

  const columns = (dark: boolean) => (
    <div className={dark ? 'dark' : 'light'} style={{ display: 'flex', gap: 24, padding: 24, borderRadius: 12, background: 'var(--bg-2)', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 280px', minWidth: 280 }}>
        <p style={labelStyle}>Anta theme · hand-tuned <code>tone="brand"</code></p>
        <BrandCard tone="brand" cardTone="brand" />
      </div>
      <div style={{ flex: '1 1 280px', minWidth: 280 }}>
        <p style={labelStyle}>Generative · <code>tone={'{seed}'}</code> + tuned formula</p>
        <BrandCard tone={seed} cardTone={derivedCardTone} btnStyle={toneVars} />
      </div>
    </div>
  )

  const formula = [
    `Deploy · primary bg`,
    `  rest    oklch(from ${seed} ${k.plRest} c h)`,
    `  hover   oklch(from ${seed} ${k.plHover} c h)`,
    `  active  oklch(from ${seed} ${k.plActive} c h)`,
    `  text    #fff`,
    ``,
    `Preview · secondary`,
    `  bg      oklch(from ${seed} ${k.bgL} ${k.bgC} h / ${k.aRest}|${k.aHover}|${k.aActive})`,
    `  text    oklch(from ${seed} ${k.fgL} ${k.fgC} h) → l − ${k.fgShift}`,
    ``,
    `Logs / Docs · tertiary / quaternary`,
    `  text    oklch(from ${seed} ${k.fgL} ${k.fgC} h)  (hover → ${k.fgStrongL})`,
    `  bg 3ry  oklch(from ${seed} ${k.bgL} ${k.bgC} h / ${k.aRest})`,
  ].join('\n')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <ColorPicker value={seed} onChange={setSeed} />
        <Checkbox checked={deriveCard} onStateChange={(_e, { next }) => setDeriveCard(next === true)} label="Also derive the card surface" />
      </div>

      <div style={{ border: '1px solid var(--border-4)', borderRadius: 10, padding: 16, background: 'var(--bg-2)', display: 'grid', gap: 16 }}>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p style={{ ...labelStyle, margin: '0 0 8px' }}>{g.title}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {g.keys.map(([key, lbl]) => (
                <div key={key} style={{ width: 96 }}>
                  <Input
                    type="number"
                    size="small"
                    label={lbl}
                    value={k[key]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={(_e, a) => set(key, a.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div>
          <p style={{ ...labelStyle, margin: '0 0 8px' }}>Actual formula (applied to the generative buttons)</p>
          <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: 'var(--bg-1)', color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--monospace)', overflowX: 'auto', border: '1px solid var(--border-4)' }}>
            {formula}
          </pre>
          <p style={{ ...labelStyle, margin: '8px 0 0', fontSize: 11 }}>
            <code>c</code> / <code>h</code> inherit from the source color. These constants override both light and dark (the shipped formula uses different dark stops).
          </p>
        </div>
      </div>

      {columns(false)}
      {columns(true)}
    </div>
  )
}

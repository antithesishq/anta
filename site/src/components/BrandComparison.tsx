import { useEffect, useState } from 'preact/hooks'
import { Card, Button, Checkbox, Input, Tooltip } from '@antadesign/anta'
import ColorPicker from './ColorPicker'

/**
 * Theming-lab harness. Wide two-column layout: the examples stack on the left
 * (hand-tuned brand over the generative one), and the title, prose, and all
 * configuration sit on the right.
 *
 * Compares the hand-tuned brand (`tone="brand"`, today's shipped literals)
 * against the generative derivation from a source color (`tone={seed}`, routed
 * through the existing custom-tone oklch formula). Follows the *page* theme —
 * Anta theming is page-level, so an opposite-theme island can't fully re-theme;
 * toggle the site theme to check the other mode. The `--_tone-*` formula stops
 * are number inputs applied inline on the generative buttons, tuning the real
 * CSS formula.
 */

const LIGHT = {
  plRest: '0.5', plHover: '0.45', plActive: '0.4',
  fgL: '0.46', fgStrongL: '0.4', fgC: '0.17', fgShift: '0.05',
  bgL: '0.54', bgC: '0.16', aRest: '0.1', aHover: '0.15', aActive: '0.2',
}
const DARK = {
  plRest: '0.45', plHover: '0.5', plActive: '0.57',
  fgL: '0.78', fgStrongL: '0.85', fgC: '0.11', fgShift: '0',
  bgL: '0.58', bgC: '0.16', aRest: '0.23', aHover: '0.28', aActive: '0.33',
}
type Consts = typeof LIGHT

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
  const [kLight, setKLight] = useState<Consts>(LIGHT)
  const [kDark, setKDark] = useState<Consts>(DARK)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    const read = () => setIsDark(el.classList.contains('dark'))
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const k = isDark ? kDark : kLight
  const setK = (key: keyof Consts, v: string) =>
    (isDark ? setKDark : setKLight)((p) => ({ ...p, [key]: v }))

  const toneVars: Record<string, string> = {}
  ;(Object.keys(VAR_OF) as (keyof Consts)[]).forEach((key) => {
    toneVars[VAR_OF[key]] = k[key]
  })

  const derivedCardTone = deriveCard ? seed : 'brand'

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
    <div className="full-bleed" style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* LEFT — examples stacked */}
      <div style={{ flex: '1 1 340px', minWidth: 300, display: 'grid', gap: 24, position: 'sticky', top: 24 }}>
        <div>
          <p style={labelStyle}>Anta theme · hand-tuned <code>tone="brand"</code></p>
          <BrandCard tone="brand" cardTone="brand" />
        </div>
        <div>
          <p style={labelStyle}>Generative · <code>tone={'{seed}'}</code> + tuned formula</p>
          <BrandCard tone={seed} cardTone={derivedCardTone} btnStyle={toneVars} />
        </div>
      </div>

      {/* RIGHT — title, prose, configuration */}
      <div style={{ flex: '1 1 440px', minWidth: 320, display: 'grid', gap: 16 }}>
        <div>
          <h1 style={{ marginTop: 0 }}>Theming — brand</h1>
          <p style={{ margin: 0, color: 'var(--text-2)' }}>
            An experiment, not a shipped feature. The examples on the left put the hand-tuned brand
            (<code>tone="brand"</code>, today's literals) next to a generative brand derived from the
            source color below (<code>tone={'{seed}'}</code>), which runs through the existing
            custom-tone oklch formula — no new CSS. At <code>#5f4bc3</code> they should read
            identically. Change the source or the formula constants and only the generative example
            follows; the hand-tuned one can't theme. It follows the site theme — toggle light / dark
            top-right.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <ColorPicker value={seed} onChange={setSeed} />
          <Checkbox checked={deriveCard} onStateChange={(_e, { next }) => setDeriveCard(next === true)} label="Also derive the card surface" />
        </div>

        <div style={{ border: '1px solid var(--border-4)', borderRadius: 10, padding: 16, background: 'var(--bg-2)', display: 'grid', gap: 16 }}>
          <p style={{ ...labelStyle, margin: 0 }}>
            Editing the <strong>{isDark ? 'dark' : 'light'}</strong> formula — follows the site theme (toggle it top-right to switch).
          </p>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p style={{ ...labelStyle, margin: '0 0 8px' }}>{g.title}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {g.keys.map(([key, lbl]) => (
                  <div key={key} style={{ width: 96, position: 'relative' }}>
                    <Input type="number" size="small" label={lbl} value={k[key]} min={0} max={1} step={0.01} onValueChange={(_e, a) => setK(key, a.value)} />
                    {key === 'fgShift' ? (
                      <Tooltip>
                        Darkens the secondary button's text: subtracted from its OKLCH lightness so
                        the label reads one step stronger than the fill tint behind it.
                      </Tooltip>
                    ) : null}
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
          </div>
        </div>
      </div>
    </div>
  )
}

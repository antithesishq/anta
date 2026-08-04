import { useState, useEffect } from 'preact/hooks'
import { Progress } from '@antadesign/anta'

export default function ProgressDemo() {
  const [value, setValue] = useState(40)
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setAnimated(v => (v >= 100 ? 0 : v + 1))
    }, 80)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h4 style={{ margin: '0 0 8px' }}>Slider control</h4>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onInput={(e) => setValue(Number((e.target as HTMLInputElement).value))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <Progress value={value} label="Upload progress" hint={`${value}%`} />
      </section>

      <section>
        <h4 style={{ margin: '0 0 8px' }}>Info tone</h4>
        <Progress value={75} tone="info" label="Processing" />
      </section>

      <section>
        <h4 style={{ margin: '0 0 8px' }}>Animated</h4>
        <Progress value={animated} />
      </section>

      <section>
        <h4 style={{ margin: '0 0 8px' }}>With bottom border</h4>
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-3)' }}>
          The component pre-declares <code>border: 0px solid var(--progress-border-color)</code>;
          set <code>border-bottom-width</code> (or any side) to enable the border. Color
          tracks the tone token automatically.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Progress
            value={60}
            label="Uploading"
            hint="3 of 5"
            style={{ borderBottomWidth: '1px' }}
          />
          <Progress
            value={75}
            tone="info"
            label="Processing"
            hint="30m left"
            style={{ borderBottomWidth: '1px' }}
          />
        </div>
      </section>
    </div>
  )
}

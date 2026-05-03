import { useEffect } from 'preact/hooks'
import { Text } from '@antadesign/anta'

const priorities = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'] as const
const tones = ['brand', 'success', 'critical', 'warning', 'info'] as const

export default function TextDemo() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <div class="demoStack">
      <section class="demoSection">
        <h4 style={{ margin: 0 }}>Priority — neutral</h4>
        {priorities.map((p) => (
          <div key={p} class="demoRow">
            <span class="demoLabel upper">priority="{p}"</span>
            <Text priority={p}>
              The quick brown fox jumps over the lazy dog with a <a href="#">link inside</a> the sentence.
            </Text>
          </div>
        ))}
      </section>

      {tones.map((tone) => (
        <section key={tone} class="demoSection">
          <h4 style={{ margin: 0 }}>Priority — tone="{tone}"</h4>
          {priorities.map((p) => (
            <div key={`${tone}-${p}`} class="demoRow">
              <span class="demoLabel upper">priority="{p}"</span>
              <Text tone={tone} priority={p}>
                The quick brown fox jumps over the lazy dog with a <a href="#">link inside</a> the sentence.
              </Text>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

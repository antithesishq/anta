import { useEffect } from 'preact/hooks'
import { Text } from '@antadesign/anta'

const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years and years and years.'

export default function TruncateDemo() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <div class="demoSection" style={{ margin: '16px 0 24px' }}>
      <div class="demoRow">
        <span class="demoLabel">truncate</span>
        <div class="demoBox"><Text truncate>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;2&#125;</span>
        <div class="demoBox"><Text truncate={2}>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;3&#125;</span>
        <div class="demoBox"><Text truncate={3}>{longText}</Text></div>
      </div>
    </div>
  )
}

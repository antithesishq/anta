import { useEffect } from 'preact/hooks'
import { Text } from '@antadesign/anta'

const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years and years and years.'
const tooltipStyle = { cursor: 'help' }

export default function TruncateDemo() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <div class="demoSection" style={{ margin: '16px 0 24px' }}>
      <div class="demoRow">
        <span class="demoLabel">truncate + automatic tooltip</span>
        <div class="demoBox"><Text truncate style={tooltipStyle}>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;2&#125;</span>
        <div class="demoBox"><Text truncate={2} style={tooltipStyle}>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;3&#125;</span>
        <div class="demoBox"><Text truncate={3} style={tooltipStyle}>{longText}</Text></div>
      </div>
    </div>
  )
}

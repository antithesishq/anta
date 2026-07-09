import { useEffect } from 'preact/hooks'
import { Text } from '@antadesign/anta'

const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years and years. Down by the river the old mill still turns, and the market stalls creak open one by one in the early light.'

export default function ExpandableDemo() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <div class="demoSection" style={{ margin: '16px 0 24px' }}>
      <div class="demoRow">
        <span class="demoLabel">truncate expandable</span>
        <div class="demoBox"><Text truncate expandable>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;3&#125; expandable</span>
        <div class="demoBox"><Text truncate={3} expandable>{longText}</Text></div>
      </div>
      <div class="demoRow">
        <span class="demoLabel">truncate=&#123;3&#125; expandable collapsible</span>
        <div class="demoBox"><Text truncate={3} expandable collapsible>{longText}</Text></div>
      </div>
    </div>
  )
}

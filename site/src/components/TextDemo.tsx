import { useState } from 'preact/hooks'
import { Tabs, Text } from '@antadesign/anta'
import { isTone, TONES } from './ToneTabs'
import styles from './TextDemo.module.css'

const priorities = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

export default function TextDemo() {
  const [tone, setTone] = useState<(typeof TONES)[number]['value']>('neutral')

  return (
    <div class={styles.explorer}>
      <Tabs
        label="Text tones"
        options={TONES}
        value={tone}
        onStateChange={(_event, { next }) => {
          if (isTone(next)) setTone(next)
        }}
      />

      <dl class={styles.samples} aria-label={`${tone} text priorities`}>
        {priorities.map((priority) => (
          <div key={priority} class={styles.sample}>
            <dt>{priority}</dt>
            <dd>
              <Text tone={tone} priority={priority}>
                The <a href="#link-behavior">link behavior section</a> shows links next to code like <code>npm install</code>.
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

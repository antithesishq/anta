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
            <dt><code>{priority}</code></dt>
            <dd>
              <Text tone={tone} priority={priority}>
                The <a href="/install/">setup guide</a> explains how to run <code>npm install</code> in a new project.
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

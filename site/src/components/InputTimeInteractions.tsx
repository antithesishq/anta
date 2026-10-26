import { useState } from 'preact/hooks'
import { Checkbox, InputTime, Tag } from '@antadesign/anta'
import styles from './InputTimeInteractions.module.css'

export default function InputTimeInteractions() {
  const [value, setValue] = useState('09:30')
  const [keep, setKeep] = useState(false)
  return <div className={styles.demo}>
    <InputTime label="Meeting" locale="en-US" value={value} clearable
      onValueChange={(_, attrs) => setValue(attrs.value)}
      onClearClick={event => { if (keep) event.preventDefault() }} />
    <Checkbox checked={keep} onStateChange={(_, { next }) => setKeep(next === true)}>Keep the value when clearing</Checkbox>
    <Tag>{value || 'Incomplete time'}</Tag>
  </div>
}

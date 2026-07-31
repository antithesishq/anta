import { useId, useState } from 'preact/hooks'
import styles from './NativeRangeDemo.module.css'

const thumbSize = 18

/** A styled native range used to document the browser control beside Slider. */
export default function NativeRangeDemo() {
  const id = useId()
  const [value, setValue] = useState(48)
  const fillEnd = `calc((100% - ${thumbSize}px) * ${value / 100} + ${thumbSize / 2}px)`

  return (
    <div className={styles.range} style={{ '--native-range-fill-end': fillEnd }}>
      <div className={styles.header}>
        <label htmlFor={id}>Native HTML range</label>
        <output htmlFor={id}>{value}%</output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        value={value}
        aria-valuetext={`${value}%`}
        onInput={(event) => setValue(Number((event.currentTarget as HTMLInputElement).value))}
      />
    </div>
  )
}

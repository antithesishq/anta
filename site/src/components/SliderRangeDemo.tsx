import { useState } from 'preact/hooks'
import { Slider } from '@antadesign/anta'

export default function SliderRangeDemo() {
  const [value, setValue] = useState<[number, number]>([20, 70])
  const [lastChange, setLastChange] = useState<[number, number] | null>(null)

  return (
    <>
      <Slider
        label="Selected interval"
        value={value}
        onValueChange={(_, { value: next }) => {
          setValue(next)
          setLastChange(next)
        }}
      />
      <p className="range-demo-output"><code>onValueChange</code>: <code>{lastChange ? JSON.stringify(lastChange) : '—'}</code></p>
    </>
  )
}

import { useState } from 'preact/hooks'
import { Button, Checkbox, Slider } from '@antadesign/anta'

export default function SliderOwnershipDemo() {
  const [value, setValue] = useState(35)
  const [accept, setAccept] = useState(true)
  const [requested, setRequested] = useState(35)

  return (
    <>
      <Checkbox label="Accept changes" checked={accept} onStateChange={(_, { next }) => setAccept(next === true)} />
      <Slider
        label="Volume"
        value={value}
        valueSuffix="%"
        onValueChange={(_, { value: next }) => {
          setRequested(next)
          if (accept) setValue(next)
        }}
      />
      <Button onClick={() => setValue(35)}>Reset to 35%</Button>
      <p>Applied: {value}%. Requested: {requested}%.</p>
    </>
  )
}

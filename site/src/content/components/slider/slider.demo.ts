/** Playground source for Slider. Kept beside the page so MDX preserves the
 * template literal's whitespace. */
export default `import { Slider } from '@antadesign/anta'

<Slider
  label="Volume"
  defaultValue={55}
  valueSuffix="%"
  markers={[
    { value: 0, label: 'Mute' },
    { value: 50, label: 'Comfortable' },
    { value: 100, label: 'Maximum' },
  ]}
  onValueChange={(_, { value }) => console.log('volume', value)}
/>
`

export const editableCode = `import { useState } from 'preact/hooks'
import { Input, Slider } from '@antadesign/anta'

function Demo() {
  const [value, setValue] = useState(55)
  const [draft, setDraft] = useState('55')

  const commit = () => {
    const number = Number(draft)
    const next = draft.trim() && Number.isFinite(number)
      ? Math.max(0, Math.min(100, Math.round(number)))
      : value
    setValue(next)
    setDraft(String(next))
  }

  return (
    <div className="editable-slider">
      <span className="editable-slider-label">Volume</span>
      <Input
        aria-label="Volume value"
        inputMode="numeric"
        trailing="%"
        value={draft}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
      <Slider
        aria-label="Volume"
        value={value}
        valueDisplay="none"
        valueSuffix="%"
        onValueChange={(_, { value: next }) => {
          setValue(next)
          setDraft(String(next))
        }}
      />
    </div>
  )
}
`

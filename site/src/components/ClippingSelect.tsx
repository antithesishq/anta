import { useEffect, useState } from 'preact/hooks'
import { Select } from '@antadesign/anta'

export default function ClippingSelect({ size }: { size: 'small' | 'medium' | 'large' }) {
  const [sample, setSample] = useState('Ấ Ë̄ g̣̱ ỵ')
  useEffect(() => {
    const text = document.querySelector<HTMLInputElement>('#sample-text')
    if (text) setSample(text.value)
    const update = (event: Event) => setSample((event as CustomEvent<string>).detail)
    document.addEventListener('clipping-sample-change', update)
    return () => document.removeEventListener('clipping-sample-change', update)
  }, [])
  useEffect(() => {
    document.dispatchEvent(new Event('clipping-preview-update'))
  }, [sample])

  return (
    <div data-select-preview>
      <Select
        size={size}
        aria-label={`${size} Select clipping sample`}
        defaultValue="sample"
        options={[
          { value: 'sample', label: sample },
          { value: 'alternate', label: `${sample} — alternate` },
        ]}
      />
    </div>
  )
}

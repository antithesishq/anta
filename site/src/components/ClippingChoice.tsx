import { useEffect, useState } from 'preact/hooks'
import { Checkbox, RadioGroup, Switch } from '@antadesign/anta'

type Props = {
  kind: 'checkbox' | 'switch' | 'radio'
  size: 'small' | 'medium' | 'large'
  withHint: boolean
  withGroupHint?: boolean
}

export default function ClippingChoice({ kind, size, withHint, withGroupHint }: Props) {
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

  const label = <span data-choice-label>{sample}</span>
  const hint = withHint ? <span data-choice-hint>{sample}</span> : undefined
  return (
    <div data-choice-preview>
      {kind === 'checkbox' ? <Checkbox size={size} label={label} hint={hint} />
        : kind === 'switch' ? <Switch size={size} label={label} hint={hint} />
        : <RadioGroup size={size} aria-label="Radio clipping sample" label={withGroupHint ? <span data-choice-group-label>{sample}</span> : undefined} hint={withGroupHint ? sample : undefined} options={[{ value: 'sample', label, hint }]} />}
    </div>
  )
}

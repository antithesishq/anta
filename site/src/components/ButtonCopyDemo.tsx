import { ButtonCopy } from '@antadesign/anta'

/**
 * Basic copy-button demo for the Button docs — a labeled and an icon-only
 * `ButtonCopy`. Hydrated as an island so the wrapper's icon / tone feedback
 * runs on click (a static `<Preview>` renders the wrapper's markup but never
 * hydrates it, so the swap wouldn't show).
 */
export default function ButtonCopyDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
      <ButtonCopy copy="https://anta.design" priority="tertiary" />
    </div>
  )
}

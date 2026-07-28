import { ButtonCopy } from '@antadesign/anta'

/**
 * Basic copy-button demo for the Button docs — a labeled, an icon-only, and a
 * wrapping no-icon `ButtonCopy`. Hydrated as an island so the ghost / tone
 * feedback runs on click (a static `<Preview>` renders the wrapper's markup but
 * never hydrates it, so the feedback wouldn't show).
 */
export default function ButtonCopyDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
      <ButtonCopy copy="https://anta.design" priority="tertiary" />
      <ButtonCopy
        copy="npm i @antadesign/anta"
        iconPlacement="none"
        priority="quaternary"
        paddingless
        style={{ width: '108px' }}
      >
        <a-button-label style={{ whiteSpace: 'normal', textWrap: 'wrap', textOverflow: 'clip' }}>
          Copy install command
        </a-button-label>
      </ButtonCopy>
    </div>
  )
}

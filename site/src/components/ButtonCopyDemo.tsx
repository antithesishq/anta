import { ButtonCopy } from '@antadesign/anta'

/**
 * Basic copy-button demo for the Button docs — a labeled, an icon-only, and a
 * no-icon `ButtonCopy`. Hydrated as an island so copy feedback runs on click.
 */
export default function ButtonCopyDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
      <ButtonCopy copy="https://anta.design" priority="tertiary" />
      <ButtonCopy
        copy="npm i @antadesign/anta"
        label="Copy install command"
        iconPlacement="none"
        priority="quaternary"
        copiedLabel="Copied to clipboard"
      />
    </div>
  )
}

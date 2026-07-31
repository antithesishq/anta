import { ButtonCopy } from '@antadesign/anta'

/**
 * Icon-placement demo for the Button docs — the copy glyph leading (default),
 * trailing, or omitted (`none`, with a confirmation label). Hydrated as an
 * island so copy feedback runs on click.
 */
export default function ButtonCopyPlacementDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <ButtonCopy copy="npm i @antadesign/anta" label="Leading" />
      <ButtonCopy copy="npm i @antadesign/anta" label="Trailing" iconPlacement="trailing" />
      <ButtonCopy copy="npm i @antadesign/anta" label="No icon" iconPlacement="none" />
    </div>
  )
}

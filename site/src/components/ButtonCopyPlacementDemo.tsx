import { ButtonCopy } from '@antadesign/anta'

/**
 * Icon-placement demo for the Button docs — the copy glyph leading (default),
 * trailing, or dropped (`none`, feedback is the ghost + tone flash). Hydrated as
 * an island so the wrapper's check / tone swap runs on click (a static
 * `<Preview>` renders the markup but never hydrates it, so the swap wouldn't show).
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

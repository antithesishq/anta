import { ButtonCopy } from '@antadesign/anta'

/**
 * Copy-the-URL demo for the Button docs — `copyUrl` copies `location.href`;
 * `copyWithUrl` prefixes a snippet with `// URL: <href>`. Hydrated as an island
 * so the wrapper's check / tone swap runs on click (a static `<Preview>` renders
 * the markup but never hydrates it, so the swap wouldn't show).
 */
export default function ButtonCopyUrlDemo() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <ButtonCopy copyUrl label="Copy link" />
      <ButtonCopy copy="npm i @antadesign/anta" copyWithUrl label="Copy snippet" priority="tertiary" />
    </div>
  )
}

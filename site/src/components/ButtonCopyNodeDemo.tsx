import { ButtonCopy, Text } from '@antadesign/anta'

/**
 * `copyNode` demo for the Button docs — a `data-copy-source` region copied as
 * rich text + plain text; the copy button strips itself from the output.
 * Hydrated as an island so the icon / tone feedback runs on click.
 */
export default function ButtonCopyNodeDemo() {
  return (
    <div
      data-copy-source
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-start',
        padding: '12px',
        border: '1px solid var(--border-5)',
        borderRadius: '6px',
      }}
    >
      <Text>The quick brown fox jumps over the lazy dog.</Text>
      <ButtonCopy copyNode label="Copy card" size="small" priority="tertiary" />
    </div>
  )
}

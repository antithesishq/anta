import { useState } from 'preact/hooks'
import { Box, Tag, Text } from '@antadesign/anta'
import type { BoxMeasurement } from '@antadesign/anta'
import { useElements } from './useElements'

/** Every `BoxMeasurement` field, in the order the type declares them. */
const FIELDS: (keyof BoxMeasurement)[] = [
  'width', 'height',
  'clientWidth', 'clientHeight',
  'scrollWidth', 'scrollHeight',
  'overflowX', 'overflowY',
  'clippedX', 'clippedY',
  'scrollableX', 'scrollableY',
  'scrollLeft', 'scrollTop',
  'hiddenStartX', 'hiddenEndX',
  'hiddenStartY', 'hiddenEndY',
]

/**
 * Live readout of one Box's `measurechange` payload.
 *
 * The tags sit outside the measured Box on purpose: inside it, every value that
 * changed would change the Box's own content, moving `scrollWidth` and firing
 * the event again.
 *
 * Mounted `client:only` so the handler is attached before the element connects.
 */
export function BoxMeasurementProbe() {
  useElements()
  const [measurement, setMeasurement] = useState<BoxMeasurement | null>(null)

  return (
    <div className="measure-probe">
      <Box
        round={8}
        className="measure-probe-box"
        onMeasureChange={(_, { current }) => setMeasurement(current)}
      >
        <Text size="small" priority="tertiary">
          Drag the bottom-right corner to resize this Box, or scroll inside it.
        </Text>
        <div className="measure-probe-wide">wide content, so both axes overflow</div>
        <div className="measure-probe-wide">and a second line, so the vertical axis does too</div>
        <div className="measure-probe-wide">and a third</div>
      </Box>

      <div className="measure-probe-readout">
        {FIELDS.map((field) => {
          const value = measurement?.[field]
          return (
            <Tag
              key={field}
              size="small"
              tone={value === true ? 'brand' : undefined}
              label={field}
              value={value === undefined ? '…' : String(value)}
            />
          )
        })}
      </div>
    </div>
  )
}

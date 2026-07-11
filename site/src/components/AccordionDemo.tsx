import { useEffect, useState } from 'preact/hooks'
import { Expander, Text } from '@antadesign/anta'

/** Registers the custom elements client-side (see TabsDemo for the pattern). */
function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const ITEMS = [
  { id: 'shipping', title: 'Shipping & delivery', body: 'Orders ship within two business days; delivery takes three to five more.' },
  { id: 'returns', title: 'Returns', body: 'Unworn items return free within 30 days of delivery.' },
  { id: 'warranty', title: 'Warranty', body: 'Every product carries a one-year limited warranty.' },
]

/**
 * Accordion — several controlled `Expander`s that share one open value, so opening one
 * folds the rest. Each `open` follows the single `openId` state; `onStateChange` reports the
 * requested state (a boolean), and we store the opened item's id (or `null` when it closes).
 */
export function AccordionDemo() {
  useElements()
  const [openId, setOpenId] = useState<string | null>('shipping')
  return (
    <div className="accordion">
      {ITEMS.map((item) => (
        <Expander
          key={item.id}
          title={item.title}
          open={openId === item.id}
          onStateChange={(_e, { next }) => setOpenId(next ? item.id : null)}
        >
          <Text>{item.body}</Text>
        </Expander>
      ))}
    </div>
  )
}

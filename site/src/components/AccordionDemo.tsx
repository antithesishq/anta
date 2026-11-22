import { useEffect, useState } from 'preact/hooks'
import { Box, Expander, Text } from '@antadesign/anta'

/** Registers the custom elements client-side (see TabsDemo for the pattern). */
function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const ITEMS = [
  {
    id: 'shipping',
    title: 'Shipping & delivery',
    body: 'Orders ship within two business days. Standard delivery takes another three to five business days. We send a tracking link as soon as your package leaves the warehouse.',
  },
  {
    id: 'returns',
    title: 'Returns',
    body: 'Unworn items can be returned free within 30 days of delivery. Keep the original packaging and start a return from your order details. We issue a refund after inspecting the returned items.',
  },
  {
    id: 'warranty',
    title: 'Warranty',
    body: 'Every product includes a one-year limited warranty covering defects in materials and workmanship. Contact support with your order number and a description of the issue so we can arrange a repair or replacement.',
  },
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
    <Box display="grid" gap={1}>
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
    </Box>
  )
}

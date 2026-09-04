import { useEffect, useState } from 'preact/hooks'
import { Box, Tag, Text } from '@antadesign/anta'
import type { BoxContext, BoxMeasurement } from '@antadesign/anta'

/** Registers the custom elements client-side (see TabsDemo for the pattern). */
function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

/**
 * Live readout of one Box's own context and size. Mounted `client:only` so the
 * handlers are attached before the element connects — `contextchange` and
 * `measurechange` both fire once on connection, and a hydrating island would
 * miss that first pair.
 *
 * The second Box sits in a `.light` scope, so on a dark page its `mode` reads
 * `light` while `globalMode` stays `dark` — the distinction the two fields exist
 * for.
 */
export function BoxContextProbe() {
  useElements()
  const [context, setContext] = useState<BoxContext | null>(null)
  const [scoped, setScoped] = useState<BoxContext | null>(null)
  const [size, setSize] = useState<BoxMeasurement | null>(null)

  return (
    <div className="context-probe">
      <Box
        display="flex"
        round={8}
        gap={6}
        className="context-probe-box"
        onContextChange={(_, { current }) => setContext(current)}
        onMeasureChange={(_, { current }) => setSize(current)}
      >
        <Tag size="small" tone="brand" label={`mode ${context?.mode ?? '…'}`} />
        <Tag size="small" label={`globalMode ${context?.globalMode ?? '…'}`} />
        <Tag size="small" label={`systemAppearance ${context?.systemAppearance ?? '…'}`} />
        <Tag size="small" tone="info" label={`${size?.width ?? 0} × ${size?.height ?? 0}`} />
        <Tag size="small" label={`os ${context?.os ?? '…'} ${context?.osVersion ?? ''}`} />
        <Tag size="small" label={`browser ${context?.browser ?? '…'} ${context?.browserVersion ?? ''}`} />
        <Tag size="small" label={`pointer ${context?.pointer ?? '…'}`} />
        <Tag size="small" label={`hover ${context?.hover ?? '…'}`} />
        <Tag size="small" label={`mobile ${context?.mobile ?? '…'}`} />
        <Tag size="small" label={`reducedMotion ${context?.reducedMotion ?? '…'}`} />
        <Tag size="small" label={`devicePixelRatio ${context?.devicePixelRatio ?? '…'}`} />
      </Box>

      <div className="light">
        <Box
          display="flex"
          round={8}
          gap={6}
          className="context-probe-box"
          onContextChange={(_, { current }) => setScoped(current)}
        >
          <Text size="small" priority="tertiary">inside a .light scope</Text>
          <Tag size="small" tone="brand" label={`mode ${scoped?.mode ?? '…'}`} />
          <Tag size="small" label={`globalMode ${scoped?.globalMode ?? '…'}`} />
        </Box>
      </div>
    </div>
  )
}

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
        <Tag size="small" tone="brand" label="mode" value={context?.mode ?? '…'} />
        <Tag size="small" label="globalMode" value={context?.globalMode ?? '…'} />
        <Tag size="small" label="systemAppearance" value={context?.systemAppearance ?? '…'} />
        <Tag size="small" tone="info" label="size" value={`${size?.width ?? 0} × ${size?.height ?? 0}`} />
        <Tag size="small" label="os" value={`${context?.os ?? '…'} ${context?.osVersion ?? ''}`.trim()} />
        <Tag size="small" label="browser" value={`${context?.browser ?? '…'} ${context?.browserVersion ?? ''}`.trim()} />
        <Tag size="small" label="pointer" value={context?.pointer ?? '…'} />
        <Tag size="small" label="hover" value={String(context?.hover ?? '…')} />
        <Tag size="small" label="mobile" value={String(context?.mobile ?? '…')} />
        <Tag size="small" label="reducedMotion" value={String(context?.reducedMotion ?? '…')} />
        <Tag size="small" label="devicePixelRatio" value={String(context?.devicePixelRatio ?? '…')} />
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
          <Tag size="small" tone="brand" label="mode" value={scoped?.mode ?? '…'} />
          <Tag size="small" label="globalMode" value={scoped?.globalMode ?? '…'} />
        </Box>
      </div>
    </div>
  )
}

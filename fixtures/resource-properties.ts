import { always } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'

interface FixtureResourceOptions {
  mountedCount: number
  mountedSelector: string
  warmupMillis?: number
  windowMillis?: number
  limits?: Partial<ResourceLimits>
}

interface ResourceLimits {
  domNodes: number
  eventListeners: number
  heapBytes: number
  layoutObjects: number
}

interface ResourceSample extends ResourceSnapshot {
  timestamp: number
}

interface ResourceSnapshot {
  domNodes: number
  eventListeners: number
  heapBytes: number
  layoutObjects: number
}

const DEFAULT_LIMITS: ResourceLimits = {
  // Resource metrics fluctuate as Chrome collects garbage and components change
  // visible state. These limits catch sustained growth rather than small churn.
  domNodes: 250,
  eventListeners: 100,
  heapBytes: 32 * 1024 * 1024,
  layoutObjects: 250,
}

export function fixtureResourceProperties({
  limits: limitOverrides,
  mountedCount,
  mountedSelector,
  warmupMillis = 30_000,
  windowMillis = 60_000,
}: FixtureResourceOptions) {
  const limits = { ...DEFAULT_LIMITS, ...limitOverrides }
  const samples: ResourceSample[] = []
  let warmupStartedAt: number | null = null

  const growth = extract((state) => {
    const comparable = state.document.querySelectorAll(mountedSelector).length === mountedCount
    const timestamp = state.resources.timestamp * 1000
    const current: ResourceSnapshot = {
      domNodes: state.resources.dom_nodes,
      eventListeners: state.resources.js_event_listeners,
      heapBytes: state.resources.js_heap_used,
      layoutObjects: state.resources.layout_objects,
    }

    if (!comparable) {
      return {
        comparable: false,
        domNodes: 0,
        eventListeners: 0,
        heapBytes: 0,
        layoutObjects: 0,
        observedWindow: false,
      }
    }

    warmupStartedAt ??= timestamp
    // Keep startup compilation, custom-element registration, and JIT work out of
    // the baseline. The latest warm-up sample becomes the first comparison point.
    if (timestamp - warmupStartedAt < warmupMillis) {
      samples.splice(0, samples.length, { ...current, timestamp })
      return {
        comparable: true,
        domNodes: 0,
        eventListeners: 0,
        heapBytes: 0,
        layoutObjects: 0,
        observedWindow: false,
      }
    }

    samples.push({ ...current, timestamp })
    const cutoff = timestamp - windowMillis
    while (samples.length > 2 && samples[1]!.timestamp <= cutoff) samples.shift()

    const baseline = samples[0]!
    return {
      comparable: true,
      domNodes: current.domNodes - baseline.domNodes,
      eventListeners: current.eventListeners - baseline.eventListeners,
      heapBytes: current.heapBytes - baseline.heapBytes,
      layoutObjects: current.layoutObjects - baseline.layoutObjects,
      // Do not enforce a trend until one complete observation window exists.
      observedWindow: timestamp - baseline.timestamp >= windowMillis,
    }
  })

  const withinLimit = (metric: keyof ResourceLimits) => {
    const current = growth.current
    return !current.comparable || !current.observedWindow || current[metric] <= limits[metric]
  }

  return {
    noDomNodeLeak: always(() => withinLimit('domNodes')),
    noEventListenerLeak: always(() => withinLimit('eventListeners')),
    noHeapGrowth: always(() => withinLimit('heapBytes')),
    noLayoutObjectLeak: always(() => withinLimit('layoutObjects')),
  }
}

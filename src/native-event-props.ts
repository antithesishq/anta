import { hydratingEventsEnabled, useLayoutEffect, useState } from './jsx-runtime'

/** @internal Forward native event props without reading or referencing the DOM. */
export function useNativeEventProps<T extends object>(events: T): Partial<T> {
  // Worker renderers need subscriptions in their first projection. Server HTML
  // serializers omit functions themselves; neither path needs a browser commit.
  if (!hydratingEventsEnabled() || typeof window === 'undefined') return events

  const [listening, setListening] = useState(false)
  // React hydration installs custom-element listeners when their props change.
  useLayoutEffect(() => setListening(true), [])
  return listening ? events : {}
}

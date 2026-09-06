import { useEffect } from 'preact/hooks'

/** Register Anta elements after the island mounts in the browser. */
export function useElements() {
  useEffect(() => { import('@antadesign/anta/elements') }, [])
}

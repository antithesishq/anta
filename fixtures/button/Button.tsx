import { useLayoutEffect } from 'react'
import { Button as AntaButton } from '@antadesign/anta'

declare global {
  interface Window {
    __antaButton?: { id: string; activations: number; requestedDisabled: boolean; requestedLoading: boolean }
  }
}

export type ButtonProps = {
  id: string
  disabled?: boolean
  loading?: boolean
}

export function Button({ id, disabled = false, loading = false }: ButtonProps) {
  useLayoutEffect(() => {
    window.__antaButton = { id, activations: 0, requestedDisabled: disabled, requestedLoading: loading }
    return () => { delete window.__antaButton }
  }, [id])

  useLayoutEffect(() => {
    window.__antaButton!.requestedDisabled = disabled
    window.__antaButton!.requestedLoading = loading
  }, [id, disabled, loading])

  return <AntaButton
      id={id}
      label="Activate"
      disabled={disabled}
      loading={loading}
      onClick={() => {
        window.__antaButton!.activations += 1
      }}
    />
}

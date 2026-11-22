import { useEffect } from 'preact/hooks'
import { Calendar } from '@antadesign/anta'

export default function ClippingCalendar({ size }: { size: 'small' | 'medium' | 'large' }) {
  useEffect(() => {
    document.dispatchEvent(new Event('clipping-preview-update'))
  }, [])
  return <Calendar size={size} locale="en-US" defaultValue="2026-01-15" />
}

import type { JSX } from 'preact'
import logo from '../../public/anta-logo.svg?raw'
import favicon from '../../public/anta-favicon.svg?raw'
import s from './AntaLogo.module.css'

interface Props {
  size: number
  compact?: boolean
  style?: JSX.CSSProperties
}

export default function AntaLogo({ size, compact = false, style }: Props) {
  // Inline SVG inherits the page's theme tokens; an image URL cannot.
  return (
    <span
      aria-hidden="true"
      className={s.logo}
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: compact ? favicon : logo }}
    />
  )
}

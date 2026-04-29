// For JSX component props
export interface BaseProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

// For intrinsic element attributes (web components need both class and className)
export interface BaseAttributes {
  class?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

export interface AProgressAttributes extends BaseAttributes {
  value?: number | string
  max?: number | string
  tone?: 'neutral' | 'info'
}

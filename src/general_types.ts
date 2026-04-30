/** Common props for JSX component wrappers. */
export interface BaseProps {
  /** CSS class name. Merged with any internal classes by the component. */
  className?: string
  /** Inline styles applied to the root element. */
  style?: React.CSSProperties
  /** Child elements. When provided, replaces the component's default label/content. */
  children?: React.ReactNode
}

/** Attributes for intrinsic custom elements (`<a-*>` tags) in JSX. */
export interface BaseAttributes {
  /** HTML `class` attribute (standard DOM). */
  class?: string
  /** React/Preact-style class name. Alias for `class`. */
  className?: string
  /** Inline styles applied to the element. */
  style?: React.CSSProperties
  children?: React.ReactNode
}

/**
 * Attributes for the `<a-progress>` custom element.
 *
 * These are the low-level web component attributes. For the JSX wrapper with
 * typed props and computed labels, use `Progress` from `@antadesign/anta`.
 */
export interface AProgressAttributes extends BaseAttributes {
  /** Current progress value. */
  value?: number | string
  /** Maximum value. Defaults to 100. */
  max?: number | string
  /** Color variant. `'neutral'` is the default gray; `'info'` is blue. */
  tone?: 'neutral' | 'info'
}

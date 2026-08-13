export const NAMED_TONES = ['neutral', 'brand', 'info', 'success', 'warning', 'critical'] as const
export const PRIORITIES = ['primary', 'secondary', 'tertiary', 'quaternary'] as const
export const SIZES = ['small', 'medium', 'large'] as const
export const ICONS = ['check', 'filter', 'heart', 'trash', 'dots-vertical'] as const

export type Tone = (typeof NAMED_TONES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Size = (typeof SIZES)[number]
export type Icon = (typeof ICONS)[number]

export type Behavior =
  | { mode: 'plain' }
  | { mode: 'href'; href: '#target' | '/test-path' }
  | { mode: 'form'; type: 'button' | 'submit' | 'reset'; outsideForm: boolean }

export type Content =
  | { kind: 'label'; label: string }
  | { kind: 'children-text'; children: string }
  | { kind: 'children-number'; children: number }
  | { kind: 'empty-children'; children: '' | '   ' | null | false }
  | { kind: 'icon-only'; icon: Icon }
  | { kind: 'icon-label'; icon: Icon; label: string }
  | { kind: 'label-trailing-icon'; label: string; iconTrailing: Icon }

export type ButtonScenario = {
  id: string
  behavior: Behavior
  content: Content
  priority: Priority
  tone: Tone
  size?: Size
  disabled: boolean
  loading: boolean
  selected: boolean
  round: boolean | number
  inherited: {
    id?: string
    title?: string
    slot?: string
    className?: string
  }
}

export type HarnessSnapshot = {
  scenarioId: string
  behavior: Behavior['mode']
  priority: Priority
  contentKind: Content['kind']
  formType: Extract<Behavior, { mode: 'form' }>['type'] | null
  complete: boolean
  disabled: boolean
  loading: boolean
  root: {
    count: number
    tag: string | null
    href: string | null
    role: string | null
    dataAnta: boolean
    tabIndex: number | null
    ariaDisabled: string | null
    ariaLabel: string | null
    text: string | null
    visual: {
      width: number | null
      height: number | null
      display: string | null
      visibility: string | null
      backgroundColor: string | null
      color: string | null
      primaryBackgroundToken: string | null
      foregroundToken: string | null
    }
  }
  events: {
    click: number
    submit: number
    submitDetailed: number
    reset: number
    navigationPrevented: number
  }
  formValue: string | null
}

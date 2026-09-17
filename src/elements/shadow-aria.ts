/** Standard semantic attributes that a shadow-hosted control may consume from
 * its custom-element host. Keeping the public spelling standard lets raw HTML,
 * React, Preact, and custom JSX runtimes use the same API. */
export const SHADOW_ARIA_ATTRIBUTES = [
  'role',
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-braillelabel',
  'aria-brailleroledescription',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-description',
  'aria-describedby',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
] as const

export type ShadowAriaAttribute = (typeof SHADOW_ARIA_ATTRIBUTES)[number]

export const SHADOW_ARIA_ATTRIBUTE_SET = new Set<string>(SHADOW_ARIA_ATTRIBUTES)

const SHADOW_ARIA_PROPERTIES: Record<ShadowAriaAttribute, string> = {
  role: 'role',
  'aria-activedescendant': 'ariaActiveDescendant',
  'aria-atomic': 'ariaAtomic',
  'aria-autocomplete': 'ariaAutoComplete',
  'aria-braillelabel': 'ariaBrailleLabel',
  'aria-brailleroledescription': 'ariaBrailleRoleDescription',
  'aria-busy': 'ariaBusy',
  'aria-checked': 'ariaChecked',
  'aria-colcount': 'ariaColCount',
  'aria-colindex': 'ariaColIndex',
  'aria-colspan': 'ariaColSpan',
  'aria-controls': 'ariaControls',
  'aria-current': 'ariaCurrent',
  'aria-description': 'ariaDescription',
  'aria-describedby': 'ariaDescribedBy',
  'aria-details': 'ariaDetails',
  'aria-disabled': 'ariaDisabled',
  'aria-dropeffect': 'ariaDropEffect',
  'aria-errormessage': 'ariaErrorMessage',
  'aria-expanded': 'ariaExpanded',
  'aria-flowto': 'ariaFlowTo',
  'aria-grabbed': 'ariaGrabbed',
  'aria-haspopup': 'ariaHasPopup',
  'aria-hidden': 'ariaHidden',
  'aria-invalid': 'ariaInvalid',
  'aria-keyshortcuts': 'ariaKeyShortcuts',
  'aria-label': 'ariaLabel',
  'aria-labelledby': 'ariaLabelledBy',
  'aria-level': 'ariaLevel',
  'aria-live': 'ariaLive',
  'aria-modal': 'ariaModal',
  'aria-multiline': 'ariaMultiLine',
  'aria-multiselectable': 'ariaMultiSelectable',
  'aria-orientation': 'ariaOrientation',
  'aria-owns': 'ariaOwns',
  'aria-placeholder': 'ariaPlaceholder',
  'aria-posinset': 'ariaPosInSet',
  'aria-pressed': 'ariaPressed',
  'aria-readonly': 'ariaReadOnly',
  'aria-relevant': 'ariaRelevant',
  'aria-required': 'ariaRequired',
  'aria-roledescription': 'ariaRoleDescription',
  'aria-rowcount': 'ariaRowCount',
  'aria-rowindex': 'ariaRowIndex',
  'aria-rowspan': 'ariaRowSpan',
  'aria-selected': 'ariaSelected',
  'aria-setsize': 'ariaSetSize',
  'aria-sort': 'ariaSort',
  'aria-valuemax': 'ariaValueMax',
  'aria-valuemin': 'ariaValueMin',
  'aria-valuenow': 'ariaValueNow',
  'aria-valuetext': 'ariaValueText',
}

export function ariaAttributeProperty(name: ShadowAriaAttribute): string {
  return SHADOW_ARIA_PROPERTIES[name]
}

type ElementReferenceTarget = Element & {
  ariaActiveDescendantElement?: Element | null
  ariaControlsElements?: Element[]
  ariaDescribedByElements?: Element[]
  ariaDetailsElements?: Element[]
  ariaErrorMessageElements?: Element[]
  ariaFlowToElements?: Element[]
  ariaLabelledByElements?: Element[]
  ariaOwnsElements?: Element[]
}

const ELEMENT_REFERENCE_PROPERTIES: Partial<Record<ShadowAriaAttribute, keyof ElementReferenceTarget>> = {
  'aria-activedescendant': 'ariaActiveDescendantElement',
  'aria-controls': 'ariaControlsElements',
  'aria-describedby': 'ariaDescribedByElements',
  'aria-details': 'ariaDetailsElements',
  'aria-errormessage': 'ariaErrorMessageElements',
  'aria-flowto': 'ariaFlowToElements',
  'aria-labelledby': 'ariaLabelledByElements',
  'aria-owns': 'ariaOwnsElements',
}

function referencedElements(host: Element, value: string): Element[] {
  const root = host.getRootNode() as Document | ShadowRoot
  if (!('getElementById' in root)) return []
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => root.getElementById(id))
    .filter((element): element is HTMLElement => element != null)
}

/** Apply one consumed host attribute to a shadow control. ID-reference ARIA
 * uses element reflection so a shadow control can reference the host's tree. */
export function applyShadowAria(
  host: Element,
  target: Element,
  name: ShadowAriaAttribute,
  value: string | null,
) {
  const property = ELEMENT_REFERENCE_PROPERTIES[name]
  if (!property) {
    if (value == null) target.removeAttribute(name)
    else target.setAttribute(name, value)
    return
  }

  const reflected = target as ElementReferenceTarget
  const elements = value == null ? [] : referencedElements(host, value)
  try {
    if (!(property in reflected)) throw new Error('ARIA element reflection is unavailable')
    if (name === 'aria-activedescendant') {
      reflected.ariaActiveDescendantElement = elements[0] ?? null
    } else {
      ;(reflected[property] as Element[] | undefined) = elements
    }
  } catch {
    // Older engines lack reflected element references. A string still works
    // when the target lives in the same shadow root and remains inspectable to
    // DOM-based tooling; cross-root references require a current engine.
    if (value == null) target.removeAttribute(name)
    else target.setAttribute(name, value)
  }
}

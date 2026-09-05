import type { BoxInputDirections, BoxPan, BoxPointerCapture, BoxWheelSettle } from '../box-input-types'

/** The empty string enables every direction; `none` keeps an explicit empty set. */
export function directionAttribute(value: BoxInputDirections | undefined): string | undefined {
  if (value === undefined || value === false) return undefined
  if (value === true) return ''
  return (['up', 'down', 'left', 'right'] as const).filter(direction => value[direction]).join(' ') || 'none'
}

export function wheelSettleAttributes(value: BoxWheelSettle | undefined) {
  if (!value) return undefined
  return {
    'wheel-delay': value.delay,
    'wheel-tolerance': value.tolerance,
    'wheel-reset-on-move': value.resetOnMove ? '' as const : undefined,
  }
}

export function pointerCaptureAttributes(value: boolean | BoxPointerCapture | undefined) {
  if (!value) return undefined
  if (value === true) return { 'pointer-capture': '' }
  return {
    'pointer-capture': value.pointerTypes?.join(' ') || (value.pointerTypes ? 'none' : ''),
    'pointer-buttons': value.buttons?.join(' ') || (value.buttons ? 'none' : undefined),
    'pointer-threshold': value.threshold,
    'pointer-modifier': value.modifier,
    'pointer-include-interactive': value.includeInteractive ? '' as const : undefined,
  }
}

export function panAttributes(value: boolean | BoxPan | undefined) {
  if (!value) return undefined
  const options = value === true ? {} : value
  const inertia = typeof options.inertia === 'object' ? options.inertia : undefined
  return {
    pan: options.axis ?? 'both' as const,
    'pan-pointer-types': options.pointerTypes?.join(' ') || (options.pointerTypes ? 'none' : undefined),
    'pan-threshold': options.threshold,
    'pan-directions': options.directions === false ? 'none' : directionAttribute(options.directions),
    'pan-inertia': options.inertia ? '' as const : undefined,
    'pan-time-constant': inertia?.timeConstant,
    'pan-min-velocity': inertia?.minVelocity,
  }
}

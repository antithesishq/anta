/**
 * Validate that a number is finite
 * @param value - the number to check
 * @param label - fully-qualified label for the error (e.g. 'plot: axis.min')
 * @returns the validated value
 */
export function validate_finite(value: number, label: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number; got ${value}`)
    }
    return value
}

/**
 * Validate that a number is finite and non-negative
 * @param value - the number to check
 * @param label - fully-qualified label for the error (e.g. 'plot.rect: size')
 * @returns the validated value
 */
export function validate_non_negative(value: number, label: string): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be a non-negative finite number; got ${value}`)
    }
    return value
}

/**
 * Validate that a number is finite and positive
 * @param value - the number to check
 * @param label - fully-qualified label for the error (e.g. 'plot: width')
 * @returns the validated value
 */
export function validate_positive(value: number, label: string): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${label} must be a positive finite number; got ${value}`)
    }
    return value
}

/**
 * Validate that a number is finite and within [0, 1]
 * @param value - the number to check
 * @param label - fully-qualified label for the error (e.g. 'plot: axis.x.padding_inner')
 * @returns the validated value
 */
export function validate_unit_interval(value: number, label: string): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${label} must be a number between 0 and 1; got ${value}`)
    }
    return value
}

/**
 * Validate that `hoverable: false` isn't combined with a tooltip or on_select. A non-hoverable series is
 * excluded from hover hit-testing entirely, so those callbacks could never fire — the combination is a bug.
 * @param args - the series args, carrying hoverable / tooltip / on_select
 * @param label - fully-qualified label for the error (e.g. 'plot.rect')
 * @returns the validated hoverable value
 */
export function validate_hoverable(
    args: { hoverable?: boolean; tooltip?: unknown; on_select?: unknown },
    label: string,
): boolean | undefined {
    if (args.hoverable !== false) {
        return args.hoverable
    }
    const conflicting: string[] = []

    if (args.tooltip !== undefined) {
        conflicting.push('tooltip')
    }

    if (args.on_select !== undefined) {
        conflicting.push('on_select')
    }

    if (conflicting.length === 0) {
        return args.hoverable
    }
    const fields = conflicting.join(' and ')
    throw new Error(`${label}: hoverable is false but ${fields} is set. A non-hoverable series is excluded from hover entirely, so ${fields} would never fire. Remove hoverable: false, or drop ${fields}.`)
}

/**
 * Validate that a hover span isn't asked for on a series excluded from hover. A non-hoverable series never
 * reaches the hit test, so widening its hit region could do nothing.
 * @param hover_span - the caller's hover_span_x / hover_span_y arg
 * @param hoverable - the validated hoverable value
 * @param field - the field being validated, for the error
 * @param label - fully-qualified label for the error (e.g. 'plot.rect')
 * @returns the validated hover span value
 */
export function validate_hover_span(hover_span: boolean, hoverable: boolean | undefined, field: string, label: string): boolean {
    if (hover_span && hoverable === false) {
        throw new Error(`${label}: ${field} is set but hoverable is false. A non-hoverable series is excluded from hover entirely, so ${field} has no effect. Drop one of them.`)
    }
    return hover_span
}

/**
 * Apply a validator only when the value is set; an undefined value passes through unchecked.
 * @param value - the number to validate, or undefined
 * @param validate - the validator to run when value is set
 * @param label - fully-qualified label for the error
 * @returns the validated value, or undefined
 */
export function validate_optional(
    value: number | undefined,
    validate: (value: number, label: string) => number,
    label: string,
): number | undefined {
    return value === undefined ? undefined : validate(value, label)
}

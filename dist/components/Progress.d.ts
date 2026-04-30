import type { BaseProps } from "../general_types";
export interface ProgressProps extends BaseProps {
    /** Current progress value. Negative values are clamped to 0. */
    value: number;
    /** Upper bound of the range. Defaults to 100. */
    max?: number;
    /** Color variant. `'info'` applies a blue tint. */
    tone?: 'neutral' | 'info';
    /** Text label displayed after the percentage. */
    label?: string;
    /** Right-aligned hint text (e.g. "3 of 7"). */
    hint?: string;
}
/**
 * Progress indicator for displaying task completion.
 *
 * Renders an `<a-progress>` web component with an optional label area
 * showing percentage, text label, and hint.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * import { Progress } from '@antadesign/anta'
 * import '@antadesign/anta/elements'
 *
 * <Progress value={60} />
 * ```
 *
 * @example With label and hint
 * ```tsx
 * <Progress value={42} label="Uploading files..." hint="3 of 7" />
 * ```
 *
 * @example Info tone
 * ```tsx
 * <Progress value={75} tone="info" label="Processing" />
 * ```
 */
export declare const Progress: ({ value, max, tone, label, hint, className, children, ...rest }: ProgressProps) => any;

import type { BaseProps } from "../general_types";
interface ProgressProps extends BaseProps {
    /** Current progress. Negative values are clamped to 0. */
    value: number;
    /** Upper bound of the range. Defaults to 100. Negative values are clamped to 0. */
    max?: number;
    tone?: 'neutral' | 'info';
    label?: string;
    hint?: string;
}
export declare const Progress: ({ value, max, tone, label, hint, className, children, ...rest }: ProgressProps) => any;
export {};

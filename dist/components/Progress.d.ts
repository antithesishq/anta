import type { BaseProps } from "../general_types";
interface ProgressProps extends BaseProps {
    value: number;
    max?: number;
    tone?: 'info';
    label?: string;
    hint?: string;
}
export declare const Progress: ({ value, max, tone, label, hint, className, children, ...rest }: ProgressProps) => any;
export {};

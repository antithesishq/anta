export interface BaseProps {
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}
export interface BaseAttributes {
    class?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}
export interface AProgressAttributes extends BaseAttributes {
    value?: number | string;
    max?: number | string;
    tone?: 'neutral' | 'info';
}

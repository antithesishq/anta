import { HTMLElementBase } from '../anta_helpers';
export declare class AProgressElement extends HTMLElementBase {
    static observedAttributes: string[];
    indicator: HTMLDivElement;
    constructor();
    connectedCallback(): void;
    attributeChangedCallback(): void;
    update(): void;
}
export declare function register_a_progress(): void;

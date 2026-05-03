import { HTMLElementBase } from '../anta_helpers';
export declare class ATextElement extends HTMLElementBase {
    static observedAttributes: string[];
    private slotEl;
    private expandBtn;
    constructor();
    attributeChangedCallback(): void;
    private handleExpand;
}
export declare function register_a_text(): void;

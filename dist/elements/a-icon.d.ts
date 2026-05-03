import { HTMLElementBase } from '../anta_helpers';
/**
 * `<a-icon shape="…">` — pure declarative icon element.
 *
 * No shadow DOM and no JS state. Styling is driven entirely by external
 * CSS: the base rule (`a-icon.css`) sets up the mask compositing, and
 * the per-shape rules (`a-icon.shapes.css`, generated) supply the
 * `--icon` URL. Color follows `currentColor`.
 */
export declare class AIconElement extends HTMLElementBase {
}
export declare function register_a_icon(): void;

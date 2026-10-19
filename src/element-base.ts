/** Use a harmless base when importing element classes without a browser DOM. */
const NativeHTMLElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement

/** Base for custom elements that can live in a different document or iframe. */
export class HTMLElementBase extends NativeHTMLElement {
  /** This element's own window, including when rendered in an iframe. */
  protected get view(): Window & typeof globalThis {
    return (this.ownerDocument?.defaultView as Window & typeof globalThis) ?? window
  }
  /** This element's own document. */
  protected get doc(): Document {
    return this.ownerDocument ?? document
  }
}

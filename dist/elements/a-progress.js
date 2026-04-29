class AProgressElement extends HTMLElement {
  static observedAttributes = ["value", "max", "tone"];
  indicator;
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        position: relative;
        overflow: hidden;
      }
      .indicator {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--_percent, 0%);
        background: var(--progress-indicator-bg);
        border-radius: 0;
        transition: width 0.2s ease;
      }
      .indicator::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 90px;
        background: var(--progress-indicator-edge);
      }
      slot {
        display: block;
        position: relative;
      }
    `;
    this.indicator = document.createElement("div");
    this.indicator.className = "indicator";
    const slot = document.createElement("slot");
    shadow.append(style, this.indicator, slot);
  }
  connectedCallback() {
    this.update();
  }
  attributeChangedCallback() {
    this.update();
  }
  update() {
    const value = Number(this.getAttribute("value") ?? 0);
    const max = Number(this.getAttribute("max") ?? 100);
    const percent = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
    this.indicator.style.setProperty("--_percent", `${percent}%`);
  }
}
function register_a_progress() {
  if (!customElements.get("a-progress")) {
    customElements.define("a-progress", AProgressElement);
  }
}
export {
  AProgressElement,
  register_a_progress
};

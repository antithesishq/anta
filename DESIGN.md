---
version: alpha
name: Anta
description: Antithesis Design System — portable UI components with a component-token-first architecture

colors: {}

typography: {}

spacing: {}

rounded: {}

components:
  progress-track:
    backgroundColor: "hsla(300, 10%, 96%, 1)"
    padding: "4px 8px"
    minHeight: "8px"

  progress-track-dark:
    backgroundColor: "hsla(278, 8%, 9%, 1)"

  progress-indicator:
    backgroundColor: "hsla(300, 7%, 92%, 1)"

  progress-indicator-dark:
    backgroundColor: "hsla(278, 8%, 15%, 1)"

  progress-indicator-info:
    backgroundColor: "#DBEDFA"

  progress-indicator-info-dark:
    backgroundColor: "#05253F"

  progress-label:
    fontSize: "13px"
    lineHeight: "16px"
    letterSpacing: "0.03em"

  progress-info:
    backgroundColor: "#E7F4FF"

  progress-info-dark:
    backgroundColor: "#021A2D"
---

# Overview

Anta is a portable UI component library built on a two-tier architecture: web components (`elements/`) provide the rendering layer via shadow DOM, and JSX wrappers (`components/`) provide a typed component API. The tiers are decoupled — wrappers emit custom element tags but never import element definitions.

Anta follows a **component-token-first** philosophy. Each component defines its own CSS custom properties (e.g., `--progress-indicator-bg`) rather than depending on a global token system. Global tokens will be introduced later for cross-component consistency, but component tokens remain the primary styling mechanism.

# Components

## Progress

A progress indicator for displaying task completion.

**Anatomy:**
- **Track** (`a-progress`) — The outer container/background bar
- **Indicator** (shadow DOM) — The filled portion, width driven by `--_percent`
- **Label** (`a-progress-label`) — Optional: contains number, text, and hint
  - **Number** (`a-progress-number`) — Percentage display
  - **Text** (`a-progress-text`) — Descriptive label
  - **Hint** (`a-progress-hint`) — Right-aligned secondary info

**Props (JSX wrapper):**
- `value: number` — Current progress value (required)
- `max?: number` — Maximum value, default 100
- `tone?: 'info'` — Color variant
- `label?: string` — Text label
- `hint?: string` — Hint text

**Variants:**
- Default — neutral gray track and indicator
- `tone="info"` — blue tinted track and indicator

**Dark mode:** Activated by `.dark` ancestor class on any parent element. All variants have dark mode counterparts.

**Component tokens (CSS custom properties):**
- `--progress-indicator-bg` — Indicator bar fill color
- `--progress-indicator-edge` — Gradient fade at the indicator's leading edge
- `--progress-label-color` — Color for the percentage number

# Do's and Don'ts

- DO use the JSX `<Progress>` wrapper for React/Preact apps — it handles percentage calculation and label layout
- DO import `anta/elements` to register the `<a-progress>` custom element before it appears in the DOM
- DO use the `tone` prop for semantic coloring — don't set indicator colors directly
- DON'T import element definitions from JSX wrapper files — binding is by tag name at runtime
- DON'T set `--_percent` from outside the component — it is shadow-internal

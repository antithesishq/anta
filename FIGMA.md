# Working with the Anta Figma library

Notes for any agent (or human) reading or syncing tokens, components, and styles from the Anta design system in Figma.

## Source of truth

- File: **Anta 0.4 — New Brand** — `8Uav3wDSj9mpgtRZsT5JY4`
- URL: https://www.figma.com/design/8Uav3wDSj9mpgtRZsT5JY4/Anta-0.4---New-Brand
- Colors overview page: node `8392:6039` (`colors`) — swatch frames for every role, tone, and theme.
- Variable collection: **"Dynamic colors"** (modes `Light` = `1:0`, `Dark` = `38:0`)
  - Role tokens live under `base/`: `base/background/`, `base/text/`, `base/border/`. The collection also holds `base/icon/*` and many `component/*` groups (button, checkbox, tag, …); those have no global counterpart in code (see "Component-token-first" in `CLAUDE.md`).
  - Most variables are aliases into the single-mode `Primitive tokens` collection (`neutral/*` for light neutrals, `burgundy/*` for dark neutrals, plus per-hue scales for the tones).

## Rules when extracting tokens

### 1. Read the full variable list from the collection — never read values off nodes

Use the **cloud Figma MCP connector** (`plugin:figma:figma`, tool `use_figma`) to enumerate every variable in the collection via the Plugin API. Two node-based shortcuts give wrong answers:

- `get_variable_defs` only returns variables actually referenced by the queried node, so tokens that aren't placed on it silently go missing (this is how `text-5`, `*-info` tones, and `border-3..5` tones once dropped out).
- Values read off the swatch frames on the colors page drifted from the collection: in September 2026 four dark neutrals (`text-3`, `text-4`, `border-1`, `border-5`) came back with stale values that only the collection dump caught.

The desktop Figma MCP (`Figma`, local app) can't run Plugin API code and only sees the file open in the active tab, so it's a fallback for screenshots and metadata, not for token values. If `plugin:figma:figma` shows `needs_auth`, sign in via `/mcp` in the session (or in the app's Connectors settings).

Working snippet for this file:

```js
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const dyn = collections.find(c => c.name === 'Dynamic colors');
const LIGHT = dyn.modes.find(m => m.name === 'Light').modeId;
const DARK = dyn.modes.find(m => m.name === 'Dark').modeId;

// Aliases cross collection boundaries; primitives are single-mode, so take the
// target's first/only mode. Tinted text 3–5 are stored as { color: alias, opacity: 0..100 }
// rather than as a plain alias — multiply the opacity into the alpha.
const resolve = async (val, depth = 0) => {
  if (!val || depth > 8) return null;
  if (val.type === 'VARIABLE_ALIAS') {
    const t = await figma.variables.getVariableByIdAsync(val.id);
    if (!t) return null;
    return resolve(t.valuesByMode[Object.keys(t.valuesByMode)[0]], depth + 1);
  }
  if (val.color) {
    const c = await resolve(val.color, depth + 1);
    return c && { ...c, a: (c.a ?? 1) * (val.opacity / 100) };
  }
  return val; // RGBA {r, g, b, a} in 0..1
};
const hex = (c) => {
  const h = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b) + ((c.a ?? 1) < 0.999 ? h(c.a) : '');
};

// Transparent helpers and the mode-invariant white have no token in code.
const SKIP = new Set(['bg-none', 'bg-1 alpha', 'text-white-stetic']);

const out = [];
for (const id of dyn.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  const name = v.name.split('/').pop();
  if (v.resolvedType !== 'COLOR' || !/^base\/(background|text|border)\//.test(v.name) || SKIP.has(name)) continue;
  const light = await resolve(v.valuesByMode[LIGHT]);
  const dark = await resolve(v.valuesByMode[DARK]);
  out.push(`${name}=${hex(light)}|${hex(dark)}`);
}
return out.join(' ');
```

Diff the result against `src/theme-antithesis.css` rather than hand-copying: the set should match one-to-one (85 tokens as of September 2026).

### 2. Mode IDs are local to a collection

A "Light" / "Dark" pair on the dynamic collection has its own mode IDs (`1:0` / `38:0`). When an alias points into `Primitive tokens`, that target has **different** mode IDs (a single `Value` mode, `11:1`). **Don't reuse the calling collection's mode IDs across collection boundaries** — take the target's only mode.

### 3. Color format mapping

- Plugin API values are RGBA in `0..1` range — convert to hex with `Math.round(channel * 255)`.
- An alpha below 1.0 becomes a trailing two-hex-digit suffix (e.g. `#912a0dcc`). The tinted text fades use `0xcc` (0.80), `0x99` (0.60), `0x66` (0.40), `0xb2` (0.70), `0x80` (0.50). Keep `b2` for 0.70 even though a straight `Math.round(0.7 * 255)` gives `b3`.

### 4. Naming convention in code

- Strip the `base/<category>/` folder from the Figma name: `base/text/text-2-brand` → `--text-2-brand`, `base/background/bg-3-info` → `--bg-3-info`.
- Backgrounds are already numbered in Figma (`bg-1 … bg-5`), matching code. (The older Anta 0.2 library named them `bg-section`/`bg-base`/`bg-pane`/`bg-block`/`bg-spot`; code kept the numeric scale.)
- Skip `bg-none`, `bg-1 alpha` (transparent helpers) and `text-white-stetic` — they have no token in code.
- Light values go on `:root, .light`; dark values go on `.dark` (Anta's `.dark` ancestor convention), in `src/theme-antithesis.css`.

### 5. Token naming categories present

Confirmed via the collection dump on 2026-09-25:

- **Backgrounds**: `bg-1` … `bg-5`. `bg-2` … `bg-5` have tones `-brand`, `-warning`, `-critical`, `-info`, `-success`; `bg-1` is neutral-only.
- **Texts**: `text-1` … `text-5`, each with the five tones.
- **Borders**: `border-1` … `border-5`, each with the five tones.
- Tone naming: `-critical` (not `-error`), `-warning` (not `-allert`). Component variant labels in Figma may use `tone=error` / `tone=allert`, which **map to** `-critical` / `-warning`.

## Where token values land in code

- `src/theme-antithesis.css` (exported as `@antadesign/anta/theme-antithesis.css`) — the Antithesis role scale from this file, as hex literals on `:root, .light` and `.dark`. It overrides the seed-derived scale in `tokens.css`.
- `src/tokens.css` — the default scale, derived from the `--anta-seed-*` tone seeds with oklch relative color. Figma values do not go here.
- Component tone curves derive from the seeds, so the Antithesis seeds (`--anta-seed-brand`, `--anta-seed-neutral`) set component colors; the role literals don't reach them.

## Component conventions

- Component instances in the Figma library use these variant axes: `level` (1–4), `priority` or `variant` (`primary`, `secondary`, `tertiary`, `quaternary`), `tone` (`neutral`, `brand`, `success`, `error`, `allert`).
- `_title` (with leading underscore) is the inner text-only sub-component used inside the slot-bearing `title` parent.
- Slots are named `leading slot`, `_title`, `trailing slot` and may be hidden in default variants — they're empty placeholders intended for composition.

## When in doubt

- For values, dump the variable collection (rule 1).
- For component names/structures, use `get_metadata` to see the tree before designing code names.
- For visual ground truth, use `get_screenshot` on the relevant node.
- Don't guess from a single component instance — Figma libraries usually contain more variants than any one example surfaces.

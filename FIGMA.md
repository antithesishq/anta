# Working with the Anta Figma library

Notes for any agent (or human) reading or syncing tokens, components, and styles from the Anta design system in Figma.

## Source of truth

- File: **Anta 0.2** — `cIvfEHHCYgJb5RYuMqBMbN`
- URL: https://www.figma.com/design/cIvfEHHCYgJb5RYuMqBMbN/Anta-0.2
- Variable collection: **"Dynamic colors"** (multi-mode: `Light`, `Dark`)
  - Tokens are organized into groups by category prefix: `background/`, `text/`, `border/`, etc.
  - Most variables are aliases that resolve to primitives in a remote `Primitive tokens` collection.

## Rules when extracting tokens

### 1. Read the full variable list from the collection — never infer from node usage

`get_variable_defs` only returns variables actually referenced by the queried node. If a token isn't placed on any visible component or example, it won't appear in those results. **This is how token gaps creep in** (e.g. missing `text-5`, `*-info` tones, `border-3..5` tones if their components aren't on the page).

The correct approach: use `use_figma` (the Plugin API) to enumerate **every** variable in the target collection, then resolve each alias chain to its concrete primitive. Working snippet for the Anta 0.2 file:

```js
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const dyn = collections.find(c => c.name === 'Dynamic colors');

const variableCache = new Map();
const getVar = async (id) => {
  if (variableCache.has(id)) return variableCache.get(id);
  const v = await figma.variables.getVariableByIdAsync(id);
  variableCache.set(id, v);
  return v;
};

// Aliases cross collection boundaries; primitives are single-mode.
// When recursing into an aliased target, take its first/only mode value.
const resolveValue = async (value, depth = 0) => {
  if (!value || depth > 6) return null;
  if (value.type === 'VARIABLE_ALIAS') {
    const target = await getVar(value.id);
    if (!target) return null;
    const modeKeys = Object.keys(target.valuesByMode);
    if (modeKeys.length === 0) return null;
    return resolveValue(target.valuesByMode[modeKeys[0]], depth + 1);
  }
  return value; // RGBA {r, g, b, a} in 0..1
};

const lightModeId = dyn.modes.find(m => m.name === 'Light').modeId;
const darkModeId = dyn.modes.find(m => m.name === 'Dark').modeId;

const out = [];
for (const vid of dyn.variableIds) {
  const v = await getVar(vid);
  if (v.resolvedType !== 'COLOR') continue;
  const light = await resolveValue(v.valuesByMode[lightModeId]);
  const dark = await resolveValue(v.valuesByMode[darkModeId]);
  out.push({ name: v.name, light, dark });
}
return out;
```

### 2. Mode IDs are local to a collection

A "Light" / "Dark" pair on the dynamic collection has its own mode IDs (e.g. `1:0` / `38:0`). When an alias points to a primitive in another collection (e.g. `Primitive tokens`), that target uses **different** mode IDs (often a single `Value` mode like `11:1`). **Don't reuse the calling collection's mode IDs across collection boundaries** — match by mode position (or just take the only mode if the target is single-mode, which is the case for our primitives).

### 3. Color format mapping

- Plugin API values are RGBA in `0..1` range — convert to hex with `Math.round(channel * 255)`.
- An alpha channel below ~1.0 should be encoded as a trailing two-hex-digit suffix (e.g. `#ada0ee99`) — the Anta library uses `0xcc` (0.80), `0x99` (0.60), `0x66` (0.40), `0xb2` (0.70), `0x80` (0.50) for the level-3/4/5 tone fades.

### 4. Naming convention in code

- Strip the category folder from the Figma name: `background/bg-base` → `--bg-base`, `text/text-2-brand` → `--text-2-brand`, `border/border-3-info` → `--border-3-info`.
- Light values go on `:root`, dark values go on `.dark` (matching Anta's existing `.dark` ancestor convention — see `src/elements/a-progress.css`).

### 5. Token naming categories present

Confirmed via the dump on 2026-05-01:

- **Backgrounds**: `bg-base`, `bg-pane`, `bg-block`, `bg-spot`, `bg-section` — each (except `bg-section`) has tones `-brand`, `-warning`, `-critical`, `-info`, `-success`. `bg-section` is neutral-only.
- **Texts**: `text-1` through `text-5`, plus `text-white`. Each numbered token has tones `-brand`, `-success`, `-warning`, `-critical`, `-info`. `text-white` is mode-invariant.
- **Borders**: `border-1` through `border-5`. Each has tones `-brand`, `-warning`, `-critical`, `-info`, `-success`.
- Tone naming: `-critical` (not `-error`), `-warning` (not `-allert`). Component variant labels in Figma use `tone=error` / `tone=allert`, which **map to** `-critical` / `-warning` in the variable names.

## Where token values land in code

- `src/anta_global_tokens.css` — exported as `@antadesign/anta/anta_global_tokens.css`.
- Each token is declared **twice**: hex first as a fallback, oklch second so capable browsers (Chrome 111+, Safari 15.4+, Firefox 113+) get perceptually-uniform values.

## Component conventions

- Component instances in the Figma library use these variant axes: `level` (1–4), `priority` or `variant` (`primary`, `secondary`, `tertiary`, `quaternary`), `tone` (`neutral`, `brand`, `success`, `error`, `allert`).
- `_title` (with leading underscore) is the inner text-only sub-component used inside the slot-bearing `title` parent.
- Slots are named `leading slot`, `_title`, `trailing slot` and may be hidden in default variants — they're empty placeholders intended for composition.

## When in doubt

- For values, dump the variable collection (rule 1).
- For component names/structures, use `get_metadata` to see the tree before designing code names.
- For visual ground truth, use `get_screenshot` on the relevant node.
- Don't guess from a single component instance — Figma libraries usually contain more variants than any one example surfaces.

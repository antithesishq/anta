# Divergences from the notebook repr()

`src/inspector-core.ts` is derived from the Antithesis notebook's `repr()` (`common/js/repr_impl.ts`,
`common/js/repr.ts`, and the DOM sink in `notebook/engine/repr/repr.ts`). This file records every place the Anta version
behaves differently **on purpose**, for the migration report. It sits beside the Inspector's source and is not
published: the package ships only `dist`, `docs`, and its license notices.

Add an entry whenever a change makes the two differ, and say why. A difference that is not deliberate is a bug, not an
entry here. Behavior kept identical on purpose, where someone might expect a change, goes in its own section. The
notebook code itself never enters this repository; entries describe behavior only.

Baseline: the `repr()` export shared for the Inspector project in November 2026.

## Architecture

1. **A lazy node tree replaces the visitor.** The notebook's `RepresentationVisitor` walks a value eagerly and emits a
   flat stream of tokens, bounded only by `char_limit`. `describe()` returns a node tree instead: a node reads nothing
   until its contents are first read, and its groups pull children one at a time, caching what they pull. This closes
   the legacy README's "lazy traversal" gap.
2. **Nodes have explicit boundaries.** A node holds its parts in order (tokens, groups of children, and inline values),
   and a child's key is kept apart from its value. The notebook's only nesting signal was `array_like_child`, with key
   tokens emitted inside the child. This closes the "explicit node boundaries" gap.
3. **Budgets are per node.** `summary(budget)` previews any node within its own budget, and `children(offset, limit)`
   pages through a group. The notebook had one global `char_limit`. This closes the "per-node budgets" gap.
4. **References are navigable.** A circular node carries the path of the ancestor it refers to, and an Inspector row
   carries that ancestor's row id. See Display, entry 19. This closes the "navigable references" gap.
5. **`repr()` is built on the node tree.** It serializes `describe(value)`, and its string output matches the notebook's
   except where this file says otherwise. `StringRepresentationVisitor` and `RepresentationVisitor` are gone.
6. **The DOM sink is not ported.** The notebook's `PrintableRepresentationVisitor` builds nested `<span>`s through the
   notebook's own `h()` wrapper. The Inspector component replaces it: `visibleRows()` lists display rows, and Anta's
   wrapper and element render them. The core has no DOM or renderer imports, so it can run in a worker next to the
   value.
7. **Options are not validated at runtime.** The notebook declares `repr()` and its options through its `expect`
   library, which checks types at call time and documents them in the notebook's `help()`. Anta uses TypeScript types
   and TSDoc instead.
8. **The string helpers are reimplemented.** `safe_string`, `safe_truncate`, and `well_known_symbols` come from a
   notebook `utility` module that was not part of the export. Anta's versions follow their names and call sites:
   `safe_truncate` never splits a surrogate pair, and `safe_string` falls back to `Object.prototype.toString`, then to
   `<unprintable>`.

## Fixes

9. **Trailing empty slots are reported next to a named property.** For an array with holes at the end and a non-index
   property, the notebook stopped at the first non-index key and dropped the trailing slots. Anta prints `[<2 empty
   slots>]{x:1}`.
10. **Repeated symbols print as `ref[...]`.** The notebook stored symbols in a separate map but looked them up in the
    object map, so they were never deduplicated. Anta prints `[Symbol("s"),ref[0]]`.
11. **A repeated function with `to_repr` is not circular.** The notebook left such a function marked as still being
    defined, so its second appearance printed `circular_ref[...]`. Anta prints `ref[...]`.
12. **It never throws.** A read that throws, such as a hostile Proxy trap, a revoked Proxy, a throwing `to_repr`, or an
    Error whose `message` getter throws, prints `<inaccessible>` and the walk continues. The notebook could throw on
    these; a Proxy whose `get` trap throws crashed it through its `obj.constructor` read. The text leaves out the error
    message, because messages from hostile values are untrusted and unbounded.
13. **`constructor` is read through property descriptors.** A `constructor` getter never runs, and a Proxy whose `get`
    trap throws still prints its data, such as `{a:1}`. The notebook read `obj.constructor` directly, which could run
    user code.
14. **Errors show their `cause`, inner `errors`, and `stack`.** These are own non-enumerable properties, which the
    notebook's `for...in` never reached, so an error printed only `Name("message")`. They now follow any enumerable
    properties, in that order: `Error("a"){cause:RangeError("b"){…},stack:"Error: a\n    at …"}`. An enumerable
    `cause` is listed once. A `stack` accessor runs only when it is the engine's own (V8 puts one on each error, Firefox
    on `Error.prototype`); a user-defined `stack` or `cause` getter never runs. V8 may call a global
    `Error.prepareStackTrace` hook when it first formats a stack, such as one installed for source maps. Summaries and
    closed Inspector rows leave the stack out, as browser DevTools do, so they read `Error("a"){cause:RangeError("b")}`;
    the new `error_stacks: false` option does the same for `repr()`.
15. **Dates print their time.** The notebook printed `Date{}`, since a Date has no enumerable properties. Anta prints
    `Date("2026-11-14T03:12:44.120Z")`, or `Date("Invalid Date")`, both valid JavaScript. Dates are recognized by
    calling the built-in `getTime` on them, so a Proxy around a Date still prints as an object and never reaches Date
    methods.

## API

16. **The custom-representation key is `Symbol.for('anta.to-repr')`.** The notebook's `to_repr` is a unique `Symbol()`
    defined in notebook code, so Anta can't reference or alias it. A registered symbol lets separately loaded copies of
    Anta agree on it. The notebook adopts the new key if it moves to Anta's core.
17. **`stopped` is always false in `to_repr`.** The notebook's visitor reported `stopped` once `char_limit` ran out, so
    a custom type could stop describing itself early. In Anta, `to_repr` runs against a recorder when its node resolves,
    and laziness bounds the reading instead: the recorded groups are pulled only as far as they are displayed.
18. **Two token types are new.** `inaccessible` marks `<inaccessible>`. `ellipsis` marks the `...` that ends truncated
    output, so the Inspector can style it; the notebook's string output added `...` as plain text.

## Display

19. **Repeated references expand in place in the Inspector.** In a lazy tree, the first appearance of a repeated value
    depends on which nodes the reader has opened, so `ref[...]` would often point at a row that isn't shown. Inspector
    rows show repeats as ordinary nodes that open in place, reading one level at a time. Only cycles become
    `circular_ref[...]` rows, linked to their ancestor row, which is always open. `repr()` and summaries keep the
    notebook's `ref[...]` labels.
20. **A nested summary shows a cycle above it as `circular_ref[...]`.** `summary()` of a node inside a cycle prints the
    reference with the ancestor's path, where a standalone `repr()` of the same sub-value would expand it once. A root
    summary matches `repr()` exactly.
21. **Strings open into lines in the Inspector.** A string with a line break, or one longer than a closed row's
    summary, can be opened. Its text then shows unescaped, one row per line, in pages of 5,000 characters. Control
    characters other than tab stay escaped, so ANSI codes are visible and can't garble the display. Strings open only
    when the reader toggles them, never from `expandDepth`. Closed rows, summaries, and `repr()` keep the notebook's
    escaped one-line form.

## Kept identical on purpose

- The string format of every value except Errors and Dates (entries 14 and 15), including quoting, number bases, empty
  slots, Map keys, and the `ref[...]` and `circular_ref[...]` labels in walk order.
- The option names `char_limit`, `deduplicate_references`, `numeric_base`, and `unquoted_strings`, and the default
  `char_limit` of 50,000.
- Getters never run, apart from the engine's own `stack` accessor (entry 14). Enumerable string-keyed data properties
  are included up the prototype chain, and symbol keys are ignored.
- The `CustomRepresentationVisitor` methods `span`, `visit`, `constructor_call`, `class_object_like`, and
  `iterable_like`.
- The notebook's property-based tests are ported to Hegel in `tests/inspector-core.test.mjs`, with the same invariants:
  output within `char_limit`, determinism, no reads past the limit, and `Object.is` agreement for primitives.

import { mkdir, writeFile } from "node:fs/promises";
import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import {
  ICONS,
  NAMED_TONES,
  PRIORITIES,
  SIZES,
  type Behavior,
  type ButtonScenario,
  type Content,
} from "./scenario";

const count = 100;
const output = new URL("./app/public/scenarios/", import.meta.url);
const labels = [
  "Save",
  "Publish",
  "Delete",
  "Filter",
  "Continue",
  "Open",
  "0",
  "Résumé",
];

function pick<T>(tc: { draw<U>(generator: any): U }, values: readonly T[]): T {
  return tc.draw(gs.oneOf(...values.map((value) => gs.just(value))));
}

const scenarios: ButtonScenario[] = [];

hegel.test(
  (tc) => {
    const behavior: Behavior = pick(tc, [
      { mode: "plain" },
      { mode: "href", href: "#target" },
      { mode: "href", href: "/test-path" },
      { mode: "form", type: "button", outsideForm: false },
      { mode: "form", type: "submit", outsideForm: false },
      { mode: "form", type: "submit", outsideForm: true },
      { mode: "form", type: "reset", outsideForm: false },
      { mode: "form", type: "reset", outsideForm: true },
    ] as const);
    const content: Content = pick(tc, [
      { kind: "label", label: pick(tc, labels) },
      { kind: "children-text", children: pick(tc, labels) },
      {
        kind: "children-number",
        children: tc.draw(gs.integers({ minValue: -1, maxValue: 100 })),
      },
      {
        kind: "empty-children",
        children: pick(tc, ["", "   ", null, false] as const),
      },
      { kind: "icon-only", icon: pick(tc, ICONS) },
      { kind: "icon-label", icon: pick(tc, ICONS), label: pick(tc, labels) },
      {
        kind: "label-trailing-icon",
        label: pick(tc, labels),
        iconTrailing: pick(tc, ICONS),
      },
    ] as const);

    scenarios.push({
      id: String(scenarios.length + 1).padStart(3, "0"),
      behavior,
      content,
      priority: pick(tc, PRIORITIES),
      tone: pick(tc, NAMED_TONES),
      size: pick(tc, [undefined, ...SIZES] as const),
      disabled: tc.draw(gs.booleans()),
      loading: tc.draw(gs.booleans()),
      selected: tc.draw(gs.booleans()),
      round: pick(tc, [false, true, 0, 10] as const),
      inherited: {
        id: tc.draw(gs.booleans())
          ? `button-${scenarios.length + 1}`
          : undefined,
        title: tc.draw(gs.booleans()) ? "Generated Button" : undefined,
        slot: tc.draw(gs.booleans()) ? "actions" : undefined,
        className: tc.draw(gs.booleans()) ? "harness-button" : undefined,
      },
    });
  },
  { testCases: count, seed: 20260812 },
);

await mkdir(output, { recursive: true });
await Promise.all(
  scenarios.map((scenario) =>
    writeFile(
      new URL(`${scenario.id}.json`, output),
      `${JSON.stringify(scenario, null, 2)}\n`,
    ),
  ),
);
await writeFile(
  new URL("index.json", output),
  `${JSON.stringify(
    scenarios.map(({ id }) => id),
    null,
    2,
  )}\n`,
);

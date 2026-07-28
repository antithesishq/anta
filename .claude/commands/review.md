---
description: Review the current changes against Anta's rubric, via the code-reviewer subagent.
argument-hint: "[base ref or paths — default origin/main]"
---

Launch the **code-reviewer** subagent (via the Agent/Task tool) to review the
current changes. Do not review the diff yourself — delegate, so the review runs
in a clean, isolated context.

Pass the subagent this scope: **$ARGUMENTS**
- If that is empty, tell it to diff against `origin/main...HEAD`.
- If it names a ref (e.g. `HEAD~3`, a branch) or paths, tell it to scope the
  diff accordingly.

Instruct the subagent to read `.github/anta-review.md`, the root `AGENTS.md`,
and the closest scoped `AGENTS.md` files first, then return its standard format
(verdict · findings by severity · design assessment for a substantial component
change · not-checked).

When it returns, relay its findings **verbatim** — do not re-review, soften, or
re-rank them. If you want, offer to apply the must-fix items afterward.

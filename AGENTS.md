## Active project scope

- Work only on `prototypes/verdant-town-3d.html` unless the user explicitly requests a scope change. This is the project's retained game.
- `prototypes/battle-rules.js` (pure battle rules: type chart, move table, formulas; no DOM or three.js) and its tests in `prototypes/tests/` are part of the game, split out at the user's request (2026-10-21). Keep rules there and presentation in the HTML; run `node --test "prototypes/tests/*.test.mjs"` after changing them.
- `src-tauri/` is the Tauri desktop shell for that page (added at the user's request). It only serves the page and its assets from disk; keep game logic in the page and its modules.
- Do not create, restore, or develop another game implementation or the removed Unreal project. The former `Game/` and `output/Windows/` folders were intentionally deleted.
- Preserve the existing supporting scripts, models, and Blender sources; changes to those files require an explicit user request extending the scope.
- Older Unreal plans and delivery reports are historical context, not the current implementation target.

## graphify

Graphify is enabled for this project using the globally installed CLI and skill. A local code-only graph exists in `graphify-out/graph.json`; it is not a semantic map of the design documents.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- Read `C:/Users/balum/.codex/skills/graphify/SKILL.md` when using Graphify. In PowerShell, call the native CLI directly; if PATH is stale, use `& 'C:/Users/balum/.local/bin/graphify.exe'`.
- Resolve the code project root before exploration. Before the first source search or exploratory source read, ensure `<project-root>/graphify-out/graph.json` exists. If missing, run `graphify extract "<project-root>" --code-only --max-workers 4`. Skip creation for empty/non-code folders or tasks unrelated to a codebase.
- Default indexing is local and code-only. Respect `.graphifyignore`; exclude generated/vendor/build/cache output and query-memory artifacts. Do not silently enable a paid API backend or document/media semantic extraction.
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Never force past graph shrink safeguards silently. If extraction or querying fails, report the specific limitation and continue with targeted source inspection; never claim that a missing, stale, or code-only graph completely maps the project.
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

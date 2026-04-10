# AI Index Specification v3

## What this is

A mind graph for AI. One markdown file that gives an AI assistant a complete mental model of a codebase — what exists, where it lives, and how everything connects. The AI reads this file and instantly knows the landscape, then drills into source code only for the parts that matter.

Not documentation. Not a README. A navigation graph with two layers: a domain index for the big picture, and function-level nodes for precise lookup.

## Purpose

1. **Mental model in one Read()** — AI reads the domain index (~50 lines) and immediately understands the codebase landscape. No blind exploration.
2. **Find duplicates** — "does something already do X?" → grep `search` terms across all nodes
3. **Trace impact** — "if I change X, what else breaks?" → grep `uses:.*\[\[X\]\]` to find all dependents
4. **Navigate** — "where does Y live?" → find the node, read source at `at`
5. **Not miss anything** — AI follows edges to find all related code. No blind grep across thousands of files.

## How AI uses this file

```
Step 1: Read Domain Index (~50 lines)
        → Know the full landscape: what domains exist, how many nodes each, which are hot

Step 2: Pick relevant domains for current task
        → Only look at domains that matter

Step 3: Grep for specific nodes
        → search: "token caching" → find the node
        → names: "TokenRetriever" → find by exact symbol
        → uses:.*[[X]] → find everything that depends on X

Step 4: Read source code at `at` paths
        → Understand actual logic. The index is a map, not the territory.
```

**Never read the whole file.** Read the domain index, then grep.

## Who maintains it

AI maintains it. After every PR, the AI updates affected nodes via `/sync-graph`. No human maintenance required. The format is designed so AI can write it without judgment calls — every field is either a file path, a name, or a list of names.

## Design principles

1. **One file, one repo.** AI reads one file to know the whole codebase. (For repos exceeding ~200 nodes, split into domain files — see Scaling section.)
2. **Domain index at the top.** A table listing every domain with node count, hot count, and one-line description. This is the AI's first read — progressive disclosure, not a context dump.
3. **Grep-first.** Every node has searchable keywords. `grep "token caching"` finds the node that does token caching.
4. **Pointers, not narratives.** File paths, names, and edges only. Never explain what the code does — the AI reads the source itself. Descriptions go stale. Source code doesn't. A wrong description is worse than no description because the AI trusts it and skips reading the source.
5. **Two granularities in one file.** Domain index for the big picture (~50 lines). Nodes for precise lookup (~5 lines each). Same file, two zoom levels.
6. **Edges are unidirectional.** Only `uses:` on each node. No `used-by:`. To find "who depends on X?", grep `uses:.*\[\[X\]\]`. This halves maintenance cost and eliminates the #1 source of graph drift.

---

## File location

```
{repo_root}/AI_INDEX.md
```

---

## Format

### Header + Domain Index

The top of the file has two parts: metadata rules, then the domain index table. This is what the AI reads first (~50 lines). Everything below is detail.

```markdown
# AI Index — {repo name}
<!-- Last updated: {ISO date} by {who/what} -->
<!-- Verified against: {commit hash} -->
<!-- Nodes: {count} | Domains: {count} -->

## Rules
- This file is navigation only. Not source of truth.
- To understand what a node does, read the source file at `at`.
- **Do NOT read this whole file.** Read the domain index below, pick relevant domains, then grep.

## Domain Index

| Domain | Nodes | Hot | What lives here |
|--------|-------|-----|-----------------|
| [Auth / RBAC](#authorization--rbac) | 13 | 6 | Auth0, permissions, scope resolver |
| [LLM Firewall](#llm-firewall-services) | 10 | 2 | Firewall processing, rule config |
| [Inventory](#inventory) | 14 | 3 | Resource CRUD, tags, dependency graph |
| ... | ... | ... | ... |
```

#### Domain Index rules

- **Every `## Domain` section must appear in the index table.** If you add a new domain, add a row.
- **"What lives here"** is ≤10 words. Not a description of what the code does — a hint of what kind of nodes you'll find inside.
- **Link format:** `[Display Name](#anchor)` where anchor is the lowercase, hyphenated `## Domain` heading.
- **Sort by importance** (hot count desc, then alphabetical) or by logical grouping — your choice, but be consistent.
- **Update counts** when nodes are added/removed via `/sync-graph`.

After the domain index, a `---` separator, then the domain sections with nodes.
- After every PR, update affected nodes.
- To find "who depends on X?", grep: `grep "uses:.*\[\[X\]\]" AI_INDEX.md`
```

### Domain section

Domains are top-level groupings (packages, modules, feature areas). They exist purely for organization — the real data is in the nodes.

```markdown
---
## {Domain Name}
```

### Node

A node is one meaningful code unit. Not every function — only ones that another developer might want to reuse, call, or needs to know exists.

**What counts as a node:**
- A class (especially one with public methods)
- A standalone function that's exported/public
- An API endpoint
- A key constant or configuration
- An action type, executor, or orchestrator

**What does NOT count:**
- Private helper functions (start with `_` and only called within same file)
- Test functions
- `__init__` files that just re-export
- Type aliases unless widely imported

```markdown
### {NodeName}
- kind: {class|function|endpoint|router|enum|config|module}
- at: `{file_path}`
- names: {actual symbol names}
- search: {natural language synonyms}
- uses: [[{NodeA}]], [[{NodeB}]] (verified), [[{NodeC}]] (inferred)
- parent: [[{ParentClass}]]
- hot: true
- tests: `{test_file_path}`
```

#### Field rules

| Field | Required | Format | Purpose |
|-------|----------|--------|---------|
| `kind` | yes | one word (see values below) | Structural query: "show me all endpoints". Zero maintenance cost. |
| `at` | yes | `relative/path.py` | Where to find the source. AI reads this file to understand. |
| `names` | yes | comma-separated symbol names | Exact grep: `grep "McpQuarantineRuleImpl"`. Finds the node by its actual code identifiers. |
| `search` | yes | comma-separated natural language terms | Concept grep: `grep "block unapproved tools"`. Finds the node when you don't know the name but know what you need. |
| `uses` | yes (empty ok) | `[[NodeName]]` links with optional confidence | What this node depends on. See Edge confidence below. |
| `parent` | no | `[[NodeName]]` | Which class/module this belongs to. A method's parent is its class. Saves a Read() to understand nesting. |
| `hot` | no | `true` | Mark nodes on the critical request path or touched frequently. AI reads these first when debugging. |
| `tests` | no | file path | Where the tests live. |

#### `kind` values

| Value | When to use |
|-------|-------------|
| `class` | A class with methods |
| `function` | A standalone function (not a method) |
| `endpoint` | A single API route |
| `router` | An API router containing multiple endpoints |
| `enum` | An enumeration |
| `config` | Settings, constants, configuration |
| `module` | A package entry point or `__init__` that re-exports significant symbols |

#### Edge confidence

Every `uses` edge can carry a confidence tag: `(verified)` or `(inferred)`.

- **`(verified)`** — the edge comes from an actual `import` or `call` statement in source code. Definitely real.
- **`(inferred)`** — the AI observed a connection that isn't a direct import (e.g. runtime registration, event-driven coupling, implicit dependency via shared config). Might be wrong.
- **No tag** — treated as `(verified)` by default. Only add `(inferred)` when the connection is uncertain.

Why this matters: when tracing impact, `(inferred)` edges should be followed but flagged as "check this manually". `(verified)` edges are trusted. This prevents the AI from confidently claiming an impact path that's actually a guess.

Example:
```
### McpQuarantineOrchestrator
- uses: [[McpQuarantineRuleImpl]] (verified), [[RuleType]] (verified), [[FastGateOrchestrator]] (inferred)
```
The link to FastGate is inferred because they don't directly import each other — they're wired together at init time.

#### Hot nodes

Nodes on the critical path (e.g. request processing pipeline, main API router, core data models) should be marked `hot: true`. This tells the AI:

- **When debugging:** read hot nodes first — they're the most likely bottleneck.
- **When reviewing:** changes to hot nodes have higher blast radius.
- **When navigating:** hot nodes are good starting points to understand the system.

Only ~5-10% of nodes should be hot. If everything is hot, nothing is.

Inspired by Aider's PageRank — they dynamically rank files by reference count. We use a simpler static annotation because our format is a flat file, not an in-memory graph.

#### Two-layer search

`names` and `search` solve different problems:

- **`names`** = the thing's actual identifiers. Use when you know the name or saw it in a stack trace. `grep "StripToolsActionExecutor"` → exact hit.
- **`search`** = how you'd describe it if you didn't know it existed. Use when checking for duplicates or looking for a capability. `grep "remove disallowed tools"` → concept hit.

#### Search term quality standard

Every node's `search` field must include at least one term from each category:

1. **Action verb** — what it does: strip, block, filter, check, dispatch, merge, validate
2. **Domain noun** — what it operates on: tools, rules, prompts, tokens, sessions, endpoints
3. **Informal synonym** — how someone would describe it without knowing the codebase: "remove bad tools", "only allow approved stuff", "run rules in parallel"
4. **Error/exception keywords** (if applicable) — exception names this node raises, error messages it produces: "StripToolsError", "CustomerIDFilterRequired"

Example:
```
### StripToolsActionExecutor
- kind: class
- at: `api/execution/action_executor/_tool_strip.py`
- names: StripToolsActionExecutor, execute
- search: strip tools, remove tools from prompt, filter tool list, delete disallowed tools, allowlist enforcement, tool removal
- uses: [[StripToolsAction]] (verified)
- hot: true
```

"strip" = action verb. "tools" = domain noun. "delete disallowed tools" = informal synonym. `hot: true` because it's on the request processing pipeline.

#### Deliberately excluded fields

- **No `does` / description.** The index is a map, not documentation. If AI wants to know what a node does, it reads the source file at `at`. Descriptions go stale. Source code doesn't. A wrong description is worse than none because the AI trusts it and skips reading source.
- **No `used-by`.** Compute it at query time: `grep "uses:.*\[\[NodeName\]\]" AI_INDEX.md`. Always accurate, zero maintenance. (Inspired by code-review-graph's blast radius which also computes inverse edges at query time via recursive BFS.)
- **No line numbers.** They change every commit. File path is stable enough. AI can grep within the file.
- **No `docs` field.** If documentation exists, it's discoverable from the repo's docs/ directory. Duplicating pointers here creates another thing to maintain.
- **No `sig:` / type signatures.** Considered but rejected — maintenance cost outweighs benefit since AI can read source in one grep. (See v3 design notes.)

#### `[[wikilinks]]` convention

`[[NodeName]]` must match exactly one `### NodeName` heading in the same file. This makes the file a self-contained graph — edges are internal links.

If a dependency is external (third-party library, not in this repo), write it as plain text without brackets: `uses: logfire, pydantic`

---

## Example

```markdown
# AI Index — rule-processor
<!-- Last updated: 2026-04-10 by Claude after PR #479 -->
<!-- Verified against: dc705067 -->
<!-- Nodes: 12 | Domains: 4 -->

## Rules
- This file is navigation only. Not source of truth.
- To understand what a node does, read the source file at `at`.
- **Do NOT read this whole file.** Read the domain index, pick relevant domains, then grep.
- To find "who depends on X?", grep: `grep "uses:.*\[\[X\]\]" AI_INDEX.md`

## Domain Index

| Domain | Nodes | Hot | What lives here |
|--------|-------|-----|-----------------|
| [Core](#core) | 3 | 1 | Rule settings, action types, enums |
| [Worker](#worker) | 2 | 1 | Rule implementations (process_input/output) |
| [API](#api) | 4 | 2 | Orchestrators, executors, processing pipeline |
| [Utils](#utils) | 1 | 0 | Shared types, VMCP schemas |

---
## Core

### McpQuarantineSettings
- kind: class
- at: `core/rules/mcp_quarantine.py`
- names: McpQuarantineSettings, INPUT_ACTION_SETTINGS, OUTPUT_ACTION_SETTINGS
- search: quarantine config, output action settings, input action settings, quarantine rule configuration
- uses: [[StripToolsSettings]] (verified), [[BlockActionSettings]] (verified), [[AlertActionSettings]] (verified)

### StripToolsAction
- kind: class
- at: `core/actions/modify_action.py`
- names: StripToolsAction, allowlist_tool_names, striplist_tool_names
- search: strip tools, remove tools, allowlist, striplist, tool removal action, delete disallowed tools, filter tool list
- uses: [[ModificationType]] (verified)
- hot: true

### RuleType
- kind: enum
- at: `core/rules/_enums.py`
- names: RuleType, McpQuarantineRule, MaliciousToolDetectionRule, PreventToolPoisoningRule
- search: rule type enum, all guardrail rules, rule registry key
- hot: true

---
## Worker

### McpQuarantineRuleImpl
- kind: class
- at: `worker/rules/mcp_quarantine.py`
- names: McpQuarantineRuleImpl, process_input, process_output, _extract_allowlist_from_kwargs
- search: quarantine rule, check tools against allow list, block unapproved tools, vmcp enforcement, tool call check
- uses: [[McpQuarantineSettings]] (verified), [[StripToolsAction]] (verified), [[BlockAction]] (verified), [[AlertAction]] (verified), [[ToolSpec]] (verified)
- parent: [[McpQuarantineRule]]
- hot: true
- tests: `worker/tests/rules/test_mcp_quarantine.py`, `worker/tests/rules/test_mcp_quarantine_output.py`

### MaliciousToolDetectionRuleImpl
- kind: class
- at: `worker/rules/malicious_tool_detection.py`
- names: MaliciousToolDetectionRuleImpl, _called_tool_names, _sanitize_flagged_names
- search: malicious tool, tool safety check, LLM judge, dangerous tool detection, unsafe tool call
- uses: [[CompletionResponse]] (verified), [[AlertAction]] (verified), [[BlockAction]] (verified)
- parent: [[MaliciousToolDetectionRule]]
- tests: `worker/tests/rules/test_malicious_tool_detection.py`

---
## API

### McpQuarantineOrchestrator
- kind: class
- at: `api/execution/orchestrator/_mcp_quarantine.py`
- names: McpQuarantineOrchestrator, _execute_quarantine_rule
- search: quarantine pre-filter, run quarantine before other rules, output short circuit, skip LLM guardrails
- uses: [[McpQuarantineRuleImpl]] (verified), [[RuleType]] (verified)
- hot: true
- tests: `api/tests/execution/test_mcp_quarantine_orchestrator.py`

### StripToolsActionExecutor
- kind: class
- at: `api/execution/action_executor/_tool_strip.py`
- names: StripToolsActionExecutor, execute
- search: strip executor, remove tools from prompt, filter tool list, delete disallowed tools, allowlist enforcement
- uses: [[StripToolsAction]] (verified)
- hot: true
- tests: `api/tests/execution/test_strip_tools_executor.py`

### QueuedOrchestrator
- kind: class
- at: `api/execution/orchestrator/_queued.py`
- names: QueuedOrchestrator, enqueue_many
- search: parallel rule execution, dispatch rules to queue, concurrent guardrail processing
- uses: [[RuleType]] (verified)
- hot: true

### OrchestratorInit
- kind: function
- at: `api/execution/orchestrator/__init__.py`
- names: init
- search: orchestrator chain, build orchestrator, wrapping layers
- uses: [[McpQuarantineOrchestrator]] (verified), [[FastGateOrchestrator]] (verified), [[FailOpenOrchestrator]] (verified), [[QueuedOrchestrator]] (verified)

---
## Utils

### ToolSpec
- kind: class
- at: `utils/vmcp/_schema.py`
- names: ToolSpec, tool_name, tool_input_schema, LlmEndpointEffectiveVmcpTools
- search: tool spec, vmcp tool definition, allowed tool entry, tool allow list item
```

---

## Update protocol

After every PR, the AI must:

1. **Add nodes** for any new class, public function, endpoint, or action type
2. **Update `uses`** edges if connections changed
3. **Delete nodes** for removed code
4. **Update the header** (date, commit hash, node count)

The AI should NOT:
- Add descriptions of what code does
- Add `used-by` edges (compute at query time via grep)
- Add private helpers as nodes
- Add test functions as nodes
- Write explanatory text outside the node format

---

## Scaling

For repos under ~200 nodes: one file works.

For larger repos (200+ nodes): split into domain files.

```
AI_INDEX.md              ← top-level: lists domains + their file paths
AI_INDEX_core.md         ← nodes for the Core domain
AI_INDEX_worker.md       ← nodes for the Worker domain
AI_INDEX_api.md          ← nodes for the API domain
```

Navigation becomes: read `AI_INDEX.md` (one Read), identify the domain, read that domain's file (one more Read). Two calls instead of one.

Cross-domain `[[wikilinks]]` use a prefix: `[[api/McpQuarantineOrchestrator]]` links to a node in `AI_INDEX_api.md`. Within a domain file, no prefix needed.

---

## Why this format

- **One file** — AI reads it in one Read() call. No file-hopping.
- **`[[wikilinks]]`** — edges are greppable. `grep "uses:.*\[\[McpQuarantine\]\]"` finds everything that depends on it.
- **`names` + `search`** — two-layer lookup. Exact match by symbol name, concept match by natural language.
- **`kind`** — one-word structural tag. Enables "show me all endpoints" without reading source.
- **`parent`** — nesting info without reading source. Instantly know if a function is a method of a class.
- **`hot`** — prioritization without PageRank. AI knows which nodes to read first. (Inspired by Aider's dynamic PageRank, adapted to static flat-file format.)
- **`(verified)` / `(inferred)`** — edge confidence. AI trusts verified edges, double-checks inferred ones. (Inspired by Graphify's EXTRACTED/INFERRED/AMBIGUOUS tagging.)
- **No `used-by`** — unidirectional edges halve maintenance. Inverse is one grep away.
- **No narrative** — pointers only. The code is the truth. This file just tells you where to look.
- **Commit hash** — staleness indicator. AI knows how fresh the graph is.

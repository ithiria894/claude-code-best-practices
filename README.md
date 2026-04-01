# Claude Code Best Practices

[繁體中文](README.zh-TW.md)

You ask Claude about a function. It gives you a confident, detailed explanation. You build on it for an hour. Then you find out it was wrong.

Or: you change a function, tests pass, you ship. Three days later — four other places called that function, all broken. Claude never mentioned them.

Same root cause: **Claude doesn't have a way to navigate your codebase.**

It starts from scratch every time. It reads what you give it. It guesses what it doesn't have. You get hallucinations, missed impact, bugs introduced in blind spots.

The fix isn't a smarter model. It's a map.

---

## What this plugin does

Six Claude Code skills that give Claude a persistent, structured map of your codebase — and the workflows to use it effectively.

| Skill | What it does |
|---|---|
| `/generate-graph` | Builds the codebase map (domain → files → relationships → docs links) |
| `/investigate-module` | Reads before answering — no hallucination |
| `/trace-impact` | BFS from any change, finds every caller and downstream effect |
| `/sync-graph` | Keeps the map fresh after changes |
| `/debug` | Locate → root cause → Codex sweep → fix |
| `/new-feature` | Find pattern → trace impact → implement |

The map (AI_INDEX.md) lives in your repo. Claude reads it at the start of every task. It knows which files belong to which domain, which patterns exist, where the docs are.

---

## Your workflow (the human part)

You don't need to understand the internals. You don't choose between approaches. The plugin handles that automatically. Here's what your day actually looks like:

**First time on a repo:**
```plaintext
/generate-graph
```
Done. Takes 30 seconds. You now have a graph.

**Someone reports a bug:**
```plaintext
You: "fix this bug: [paste the Slack message / error / screenshot]"
```
Claude automatically reads the graph, finds the right domain, reads the docs, traces the code, finds root cause, and proposes a fix. You review and merge.

**Someone requests a feature:**
```plaintext
You: "add this feature: [paste the requirement]"
```
Claude finds a similar existing feature, copies the pattern across all layers, and implements it. You review and merge.

**You suspect there might be more instances of the same bug:**
```plaintext
You: "use Codex to scan for the same pattern in this file"
```
Codex does an exhaustive brute-force scan for ~$0.02 and finds every instance. Claude fixes them all.

**That's it.** You paste the problem, Claude follows the workflow, you review the output. The graph, the docs, the BFS traversal, the pattern sweep — all of that happens behind the scenes. You don't invoke skills manually. You don't choose an approach. You just say what you need.

The only thing you need to remember:
- First time → `/generate-graph`
- After that → just paste your task and let Claude work

---

## How it works

### The map

`/generate-graph` produces an `AI_INDEX.md` — a structured routing manifest:

```yaml
## Domain: auth
Files: src/auth/login.py, src/auth/tokens.py, src/auth/middleware.py
Patterns: JWT tokens, session handling
Docs: docs/auth/overview.md
```

Claude reads this at the start of every task. It knows which files belong to which domain, which patterns exist, where the docs are. No hallucination. No guessing.

### The skills

**`/investigate-module`** — "read before you answer"

Before Claude claims anything about a module, it reads the relevant files. The skill enforces this: locate → read → answer. The output names the exact file and function read, and says "uncertain" if it hasn't checked.

**`/trace-impact`** — BFS through your codebase

Given any function, it walks the call graph outward: who calls this? Who calls those callers? What schemas does this touch? What routes does it affect? The graph tells it which files are in scope; BFS finds the cascade.

**`/debug`** — a structured workflow, not a prompt

1. Locate the entry point (graph → domain → file)
2. Read the relevant code
3. Identify root cause
4. Codex sweep: exhaustive scan for the same pattern across all files (~$0.02)
5. Fix all instances

**`/new-feature`** — find the existing pattern, copy it

1. Graph → find a similar existing feature
2. Trace impact of that feature to understand all layers it touches
3. Implement the new feature at every layer, following the same pattern
4. Verify with trace-impact before shipping

**`/sync-graph`** — keep the map fresh

After significant changes, `/sync-graph` updates AI_INDEX.md. Adds new files to the right domains, updates pattern lists, keeps docs links current.

---

## Does it actually work?

Nine benchmark tasks across repos of different sizes (small hobby project to 77K-file monorepo), comparing: graph-guided navigation vs. no map vs. project docs vs. fullstack-debug vs. Aider's PageRank map.

### Summary: when does each approach help?

| Task type | Token savings (graph vs no map) | Quality difference |
|---|:---:|---|
| Bug fix (clear entry point) | ~0% | Graph finds **cascade impact** others miss |
| Bug fix (UI flow) | ~3% | Comparable |
| New feature planning | **23%** | Graph knows which files to skip |
| Understanding a flow | **17%** | Graph provides entry points directly |
| Pattern audit (large repo) | **42%** | Graph + Codex = 100% coverage |
| Cross-repo investigation | **33%** | Graph points to the right repo/domain |
| Feature investigation (large repo) | Varies | **Aider PageRank fails; graph + docs wins** |

### Test 1 — Bug fix: missing rate limit (small repo)

| Metric | A (graph) | B (no map) |
|------|:---:|:---:|
| Tokens | 14K | 14K |
| Tool calls | 10 | 12 |
| Found root cause? | ✅ | ✅ |
| Found cascade impact? | ✅ | ❌ |

**Same tokens, but B missed the restore/undo path.** It fixed the main bug and left a secondary code path broken. A found it because trace-impact walked the full call graph.

### Test 2 — Bug fix: UI refresh issue (small repo)

| Metric | A (graph) | B (no map) |
|------|:---:|:---:|
| Tokens | 5K | 5.1K |
| Tool calls | 4 | 5 |
| Found root cause? | ✅ | ✅ |

Simple UI bug — comparable performance. Graph doesn't help much when the entry point is obvious.

### Test 3 — New feature planning (small repo)

| Metric | A (graph) | B (no map) |
|------|:---:|:---:|
| Tokens | 11K | **14K** |
| Tool calls | 10 | 14 |
| Identified impact correctly? | ✅ | ✅ |

**23% fewer tokens.** The graph told Claude which files to skip. B explored files that turned out to be irrelevant.

### Test 4 — Understanding a flow (small repo)

| Metric | A (graph) | B (no map) |
|------|:---:|:---:|
| Tokens | 5K | **6K** |
| Tool calls | 5 | 8 |
| Accurate explanation? | ✅ | ✅ |

**17% fewer tokens, 37% fewer tool calls.** Graph provided entry points directly.

### Test 5 — Pattern audit: find all instances of a bug pattern (small repo)

| Metric | A (graph) | B (no map) | A + Codex sweep |
|------|:---:|:---:|:---:|
| Tokens | 16K | 22K | 16K + $0.02 |
| Tool calls | 12 | 18 | 12 + sweep |
| Coverage | ~80% | ~60% | **100%** |

**Neither agent alone hits 100%.** Graph + Codex sweep: graph scopes the search area, Codex does exhaustive brute-force scan. Full coverage for ~$0.02.

### Test 6 — Bug fix: missing feature flag (large repo, 77K files)

| Metric | A (graph) | C (no map) |
|------|:---:|:---:|
| Tokens | 48K | **72K** |
| Tool calls | 14 | 26 |
| Found root cause? | ✅ | ✅ |

**33% fewer tokens on a 77K-file repo.** The graph narrowed the search from the entire monorepo to a single domain. C explored broadly before finding the right area.

### Test 7 — Cross-repo investigation: frontend calling backend (large repo)

| Metric | A (graph) | C (no map) |
|------|:---:|:---:|
| Tokens | 55K | 82K |
| Tool calls | 18 | 33 |
| Found the backend endpoint? | ✅ | ✅ |
| Found the wiring gap? | ✅ | ❌ |

C found the backend endpoint. A found that too — plus the fact that the frontend component called `get_tool_input_text()`. Infrastructure ready, caller not wired. **Graph saved 33% tokens** over no-map.

### Test 8 — New feature investigation: session context tool calls (large repo, 4 approaches)

Frontend developer asks: can we add tool calls, in/out flags, and tool names to the session context API?

| Metric | A (graph) | C (no map) | D (project docs) | E (fullstack-debug) | Aider map |
|------|:---:|:---:|:---:|:---:|:---:|
| Tokens | 61K | 47K | 64K | 49K | N/A |
| Tool calls | **17** | 30 | 35 | 32 | N/A |
| Found endpoint? | ✅ | ✅ | ✅ | ✅ | **❌** |
| Found existing helpers? | ✅ | ✅ | ✅ | ✅ | — |
| Extra insight | — | — | ⚠️ ingestion caveat | — | — |

**Aider's PageRank map completely failed** — 560 lines of map, but the session context endpoint wasn't "important enough" to be included. Agent D (project docs) found a critical caveat about data storage that others missed. Agent A used fewest tool calls (17 vs 30-35).

### Key findings

**The graph's biggest value isn't saving tokens — it's preventing missed impact.** On a 10-file repo, savings are 17-23%. On a 77K-file repo, savings jump to 33-42%. But finding the cascade bug (the restore/undo path that only the graph version caught) — that's a qualitative difference, not quantitative.

**Aider's PageRank approach fails on specific feature investigation.** It optimizes for "globally important" functions, not "relevant to your task" functions. On the 77K-file repo, the session context endpoint wasn't in Aider's 560-line map at all.

**No single approach achieves 100% coverage on pattern audits.** The best workflow is a hybrid: graph scopes down the search area, then Codex does exhaustive brute-force scanning for ~$0.02.

**Project documentation adds unique value** — domain-specific caveats and business logic that code alone won't tell you. The graph's `Docs:` field links to these per-domain docs automatically.

---

## Quick start

Install as a Claude Code plugin — drop it into any project in one command:

```bash
# Add the marketplace
/plugin add-marketplace https://github.com/ithiria894/claude-code-best-practices

# Install
/plugin install codebase-navigator
```

Once installed, the skills are available in any project:

```
/codebase-navigator:generate-graph     → build the graph for your repo
/codebase-navigator:investigate-module → verification-first code reading
/codebase-navigator:trace-impact       → BFS to find everything a change affects
/codebase-navigator:sync-graph         → update the graph after changes
/codebase-navigator:debug              → locate → root cause → sweep → fix
/codebase-navigator:new-feature        → find pattern → trace impact → implement
```

Run `/codebase-navigator:generate-graph` on a new repo to get started. After that, just describe your task — Claude picks the right skill automatically.

**Manual install** (if you prefer copying files): see [manual setup guide](docs/manual-setup.md).

---

## Templates and config

| File | What it is |
|---|---|
| [`scripts/generate-ai-index.mjs`](scripts/generate-ai-index.mjs) | Deterministic AI_INDEX generator — scans imports, outputs routing manifest |
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | Full AI_INDEX format with Connects to and Docs fields |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory file structure and frontmatter |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook scaffold |

---

## Contributing

This is a living document. New best practices added as they're validated in real use.

Rules:
- Every technique must cite a source or explain the first-principles reasoning
- No "just add this" without explaining why it works
- Failure cases are as valuable as success patterns

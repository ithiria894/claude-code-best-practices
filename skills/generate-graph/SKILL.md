---
name: generate-graph
description: Generate or update the codebase graph (AI_INDEX.md). Script builds the skeleton (~85%), Claude fills the edges to 100%. Run on new repos or after structural changes.
---

> **[codebase-navigator plugin — generate-graph skill]**

# Generate Graph

Generate or update the repo's codebase graph (AI_INDEX.md). Two-phase process: script builds the skeleton, Claude fills the gaps.

---

## Rules

- AI_INDEX.md is navigation only. Never write explanations of how code works.
- If an entry sounds like documentation, rewrite it as a pointer.
- Final output must be under 250 lines. 4–8 lines per domain.
- Every "Connects to" must come from an actual import/call, not guessing.

---

## Phase 0 — First-run setup (only once per repo)

Ask the user two questions:

1. **Where is your source code?** (e.g., `src/`, `app/`, `lib/`) — default: `src/`
2. **Does this repo have developer documentation?** (e.g., `docs/`, `wiki/`, `documentation/`) — if yes, the script auto-links matching docs to each domain via the `Docs:` field.

If the user doesn't know, scan the repo root: `ls` for common directories.

---

## Phase 1 — Script builds the skeleton (~85%)

```bash
node scripts/generate-ai-index.mjs [srcDir] [testDir] > AI_INDEX_DRAFT.md
```

The script auto-detects:
- Domains (top-level directories or flat files in src/)
- Entry files (index/main/mod/__init__, or shortest filename)
- Exported symbols (functions, classes, types, interfaces)
- Cross-domain imports → "Connects to" edges with symbol names
- HTTP routes (Express, Flask, FastAPI, NestJS, raw HTTP patterns)
- Test file mapping (by domain/filename matching)

If the script is not available, go to Phase 2 directly (manual full scan).

---

## Phase 2 — Claude fills the gaps to 100%

Read the script output in AI_INDEX_DRAFT.md. For each domain, verify and fix:

### 2a — Missing edges (most important)

The script detects imports but may miss:
- **HTTP/RPC connections** the regex didn't catch → grep for route patterns:
  ```bash
  grep -rn "router\.\|app\.\(get\|post\)\|@app\.route\|path ===" src/
  ```
- **Frontend → Backend calls** → grep for fetch/axios URLs:
  ```bash
  grep -rn "fetch\|axios\|/api/" src/ui/ src/frontend/ src/client/
  ```
- **Implicit dependencies** (event emitters, middleware chains, DI containers) → read entry files of connected domains

For each missing edge found, add it:
```markdown
- Connects to:
  - New domain — via function_name() in src/path/file.py
```

### 2b — Weak Search terms

The script extracts exported symbol names, but sometimes:
- Only one generic name (e.g., `scan` instead of `scanAll, scanScope, discoverProjects`)
- This happens when a module wraps internals behind a single export

Fix: read the entry file, find the top 3-5 most-used public functions, add them:
```markdown
- Search: scanAll, scanScope, discoverProjects, CATEGORIES
```

### 2c — Wrong test mapping

The script matches tests by filename, which can be wrong (e.g., `pw-scanner-upgrade.cjs` is not a unit test for scanner). Fix:
- Remove non-unit/non-integration tests
- Add correct tests by grepping for domain symbols in test files:
  ```bash
  grep -rl "scanAll\|scanScope" tests/
  ```

### 2d — Missing descriptions

Add a short parenthetical label to each domain name if not obvious:
```markdown
### Scanner (discovery engine)    ← what it does in 2-3 words
### Mover (mutation layer)
### Effective (scope resolution)
```

### 2e — Link domain docs

The script auto-detects docs in `docs/` directories. If a domain has no `Docs:` line but the repo has documentation:

1. Ask the user: "Does this repo have developer documentation? Where is it?" (e.g., `docs/`, `wiki/`, `documentation/`)
2. For each domain, find matching docs and add:
```markdown
- Docs: `docs/knowledge-graph/firewall.md`, `docs/api/firewall.md`
```

Domain docs contain business logic, caveats, and design decisions that code alone won't tell you. The `/debug` and `/new-feature` workflows read these before tracing code.

---

## Phase 3 — Validate

- [ ] Every Entry file exists
- [ ] Every Tests file exists
- [ ] Every "Connects to" is a real import/call
- [ ] No explanations, no "usually", no "roughly"
- [ ] Search terms are actual exported symbol names
- [ ] Every domain that imports from another has a "Connects to" edge
- [ ] Domains with known documentation have a `Docs:` link

---

## Phase 4 — Finalize

```bash
mv AI_INDEX_DRAFT.md AI_INDEX.md
```

---

## Output format

```markdown
# AI_INDEX.md

## How to use this file
- Navigation only. Not source of truth.
- Read actual source files before making any claim.

---

### Domain name (short description)
- Entry: `path/to/entry.py`
- Search: symbol1, symbol2, symbol3
- Routes: `GET /api/resource`, `POST /api/action`
- Tests: `tests/test_domain.py`
- Docs: `docs/knowledge-graph/domain.md`, `docs/api/domain.md`
- Connects to:
  - Other domain — via function() in file.py
  - API layer — via POST /endpoint in routes.py
```

---

## When to update

Run this skill when:
- You add a new module or domain
- You rename or move entry files
- You add new cross-domain connections
- `ls src/` looks different from what the index describes

For incremental updates after a feature/bug fix, use `/sync-graph` instead.

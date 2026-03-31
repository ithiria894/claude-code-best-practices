---
name: generate-index
description: Generate or update AI_INDEX.md for the current repo. Uses deterministic script first, then Claude refines. Run on new repos or after structural changes.
disable-model-invocation: true
---

# Generate Index

Generate or update the repo's AI_INDEX.md.

---

## Rules

- AI_INDEX.md is navigation only. Never write explanations of how code works.
- If an entry sounds like documentation, rewrite it as a pointer.
- Final output must be under 250 lines. 4–8 lines per domain.
- Every "Connects to" must come from an actual import/call, not guessing.

---

## Step 1 — Run the generator script

```bash
node scripts/generate-ai-index.mjs [srcDir] [testDir] > AI_INDEX.md
```

If the script is not available, go to Step 2.

---

## Step 2 — Manual scan (fallback)

For each top-level directory or logical domain in the source:

```bash
# Find entry file
ls src/<domain>/

# Find exported symbols → search terms
grep -n "^export\|^def \|^class " src/<domain>/<entry_file>

# Find who imports this domain → Connects to
grep -rn "import.*<domain>\|require.*<domain>" src/

# Find tests
grep -rl "<domain_name>\|<entry_filename>" tests/
```

---

## Step 3 — Refine the output

Review the generated AI_INDEX.md and fix:

- Add HTTP API endpoints as "Connects to" entries (grep for `router.` or `app.get/post`)
- Add frontend → backend connections if the script missed them
- Merge single-file domains that belong together
- Remove utility domains that aren't real feature domains
- Ensure Search terms are what someone would actually grep for

---

## Step 4 — Validate

- [ ] Every Entry file exists
- [ ] Every Tests file exists
- [ ] Every "Connects to" is a real import/call
- [ ] No explanations, no "usually", no "roughly"
- [ ] Under 250 lines
- [ ] Search terms are actual exported symbol names

---

## Output format

```markdown
# AI_INDEX.md

## How to use this file
- Navigation only. Not source of truth.
- Read actual source files before making any claim.

---

### Domain name
- Entry: `path/to/entry.py`
- Search: symbol1, symbol2, symbol3
- Tests: `tests/test_domain.py`
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
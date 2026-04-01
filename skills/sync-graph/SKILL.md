---
name: sync-graph
description: Update AI_INDEX.md after a feature or bug fix, while Claude still has session memory of what changed. Run immediately after completing work — before /clear.
---

> **[codebase-navigator plugin — sync-graph skill]**

# Sync Graph

Update AI_INDEX.md to reflect what just changed in this session. Run this *before* `/clear` — Claude still knows which files were touched and why.

This is a surgical update, not a full rebuild. Only touch affected domains.

---

## Rules

- Do not rewrite the whole index. Only update entries for affected domains.
- Every "Connects to" must come from an actual import/call you read or added.
- If a change is internal to a domain (no new imports, no new exports), the index does not change.
- If uncertain whether an entry needs updating, check git diff, then decide.

---

## Step 1 — Identify what changed this session

Recall from session context OR run:

```bash
git diff --name-only
git diff --name-only --cached
```

Group changed files by domain (first-level directory or logical module).

For each changed file, answer:
- Did this file add or remove an **export**? (new public function, class, or constant)
- Did this file add or remove an **import from another domain**? (new cross-domain edge)
- Was this file **created** or **deleted**? (domain structure changed)
- Was the **entry file** affected? (the file listed under `Entry:` in the index)

If all answers are no → this domain's index entry is unchanged. Skip it.

---

## Step 2 — For each domain that changed, update its entry

Read the current AI_INDEX.md entry for the affected domain. Then apply the minimum change:

**If a new export was added:**
```
Search: symbol1, symbol2, symbol3, NEW_SYMBOL
```

**If a new import was added (new cross-domain connection):**
```
Connects to:
  - Existing domain — via existing_fn() in file.py
  - New domain — via new_fn() in file.py   ← add this line
```

**If an import was removed:**
Remove the corresponding "Connects to" line.

**If the entry file moved or was renamed:**
```
Entry: `new/path/to/entry.py`
```

**If a new domain was added** (new top-level directory or new logical module):
Add a full new entry block:
```markdown
### New domain name
- Entry: `src/new_domain/entry.py`
- Search: ExportedSymbol1, ExportedSymbol2
- Tests: `tests/test_new_domain.py`
- Connects to:
  - Other domain — via function() in file.py
```

**If a domain was deleted:**
Remove its entry block entirely.

---

## Step 3 — Verify your edits

Before writing:

- [ ] Every edited `Entry:` file actually exists
- [ ] Every edited `Tests:` file actually exists
- [ ] Every new "Connects to" line comes from an actual import you added this session
- [ ] No entry exceeds 8 lines
- [ ] Total index still under 250 lines
- [ ] No explanations added — only pointers

---

## Step 4 — Write the update

Edit AI_INDEX.md in place. Do not regenerate the whole file.

After writing, show a summary:

```
Synced AI_INDEX.md:
- Updated: [domain names whose entries changed]
- Added: [new domain names]
- Removed: [deleted domain names]
- Unchanged: [domains touched in session but index didn't need updating]
```

---

## When this skill does NOT apply

- You only changed internal logic (no new exports, no new imports between domains) → skip
- You only changed tests → skip, unless you added a test for a domain not yet listed under `Tests:`
- You added a dependency to an external package (not a local domain) → skip

---

## Tip: chain with trace-impact

This skill pairs with `/trace-impact`:

```
Before work:  /trace-impact  — understand blast radius
Do the work
After work:   /sync-graph    — update the map to reflect what changed
```

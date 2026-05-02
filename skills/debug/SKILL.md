---
name: debug
description: Debug a bug from report to fix. Locates the layer, finds root cause, sweeps for same pattern elsewhere, then fixes. Use when given a bug report, error message, or "X is broken".
---

# Debug

Find the layer where the data goes wrong, fix it there, then check if the same pattern exists elsewhere.

---

## The Holy Trinity — Evidence Before Fix

Every bug investigation requires evidence from ALL THREE sources before declaring root cause. Missing any one = incomplete.

```
    Observability (logs/traces/frontend)
         ▲
        / \
       /   \
      /     \
     ▼       ▼
 Database ◄► Source Code
```

| Source | What it tells you |
|--------|------------------|
| **Observability** | What actually happened at runtime — which functions ran, what data they received, what they produced |
| **Database** | What was persisted — the ground truth of what the system stored |
| **Source Code** | What the code is SUPPOSED to do — only trustworthy AFTER you know what actually happened |

### Debugging order — non-negotiable

```
1. Observability (traces, logs, or reproduce in frontend → capture network)
   ↓  find the actual request, trace the data flow
2. Database records
   ↓  confirm what was persisted, match to traces
3. Source code
   ↓  NOW read code with context of what actually happened
4. Root cause (where actual data diverged from expected)
5. Fix — or declare "not a bug" if the system worked correctly
```

**NEVER start with code reading.** Reading code first creates a hypothesis that biases all subsequent investigation. You unconsciously seek evidence that confirms it. Start with runtime data, form understanding from evidence, then verify against code.

### Anti-pattern: "code-reading fix"

1. PM reports bug X
2. You read code, spot something suspicious
3. You fix it and claim it resolves bug X
4. You never traced the PM's actual session/request through logs and DB

The fix might be valid for a DIFFERENT bug. Without an end-to-end trace of the reported case, you don't know.

### Presenting findings

When explaining a bug (or non-bug) to PM/team:

1. **Filtered trace link** — filter to key spans only, include time range
2. **Key spans table** — time, span name, what to click, what they'll see inside
3. **DB records** — session/action rows matching the trace
4. **Data flow diagram** — ASCII with actual data values at each step
5. **One-sentence root cause**

The recipient must be able to independently verify every claim.

---

## Phase 0 — Understand the report

Extract from the bug report:
- What's broken? (wrong data, crash, 500, missing field, wrong behavior)
- Any entry point? (API endpoint, error message, stack trace, log link)
- Steps to reproduce (if provided)

---

## Phase 1 — Locate the entry point

Go with whatever you have. Don't reproduce if you already have an entry point.

**If you have an API endpoint or error trace** → go straight to Phase 2.

**If you have a log/trace link** → read the trace, find which function errored → Phase 2.

**If you only have "X is broken" with no details** → reproduce it yourself:
1. Open the app, trigger the bug
2. Capture the network request / error
3. Now you have the endpoint → Phase 2

---

## Phase 2 — Find root cause

### Step 1: Read AI_INDEX.md

Identify which domain the endpoint belongs to. Note:
- Entry file and search keywords
- Relevant `change_surfaces`
- Any `must_check` rules that might point to hidden coupling

### Step 2: Trace the stack

From the entry point, trace inward:

```
API route / endpoint handler
  → service / business logic
    → data layer (DB query, API call, file read)
      → the actual data
```

At each layer, ask: **is the data correct here?**
- Data correct at this layer → bug is in the layer above (consumer)
- Data wrong at this layer → go one layer deeper

### Step 2b: Escape hatch — is this even our code?

If you can't trace the root cause after Step 2, stop and ask:
- Is the bug in code this repo owns? Or in another team's service/repo?
- Is the data coming from an external dependency, third-party package, or another microservice?
- Am I looking at a configuration mismatch between two systems rather than a code bug?

If the answer is "not our code" → stop debugging, report what you found, and redirect to the owning team. Don't force-fit a root cause into code you don't own.

### Step 3: Confirm root cause

Name the exact file, function, and line where the data goes wrong. Read the source — don't guess.

```
Root cause: src/mover.mjs:deleteItem (line 371)
  — queries LlmFirewallProjectStagedConfig with customer_id only
  — missing project_id filter (PROJECT-scoped model requires it)
```

---

## Phase 3 — Pattern sweep

**Don't just fix the one instance.** Check if the same bug pattern exists elsewhere.

### Step 1: Scope down

Use AI_INDEX.md to identify which files/directories to scan:
- Same domain's other functions
- Connected domains that might have the same pattern

### Step 2: Exhaustive scan

If the file is large (500+ lines) or the pattern might repeat across many files, do a structured repo scan with the search tools available in your environment.

```bash
rg -n "[pattern]" [file-or-directory]
```

Do not stop at the first hit. Enumerate every plausible instance and produce a short triage list such as:

```text
LINE | FUNCTION OR BLOCK | STATUS
118  | delete_item       | MISSING project_id
221  | upsert_item       | OK
377  | bulk_delete       | MISSING project_id
```

### Step 3: Triage

- Same code path as reported bug → fix now
- Different code path, same pattern → fix now if easy, otherwise note in PR
- Edge case / not reachable in production → note but skip

### When to skip pattern sweep

- Bug is a one-off logic error (not a repeated pattern)
- The fix is a config change, not a code pattern
- File is small enough that you already read the whole thing

---

## Phase 4 — Fix, verify, and sync

1. Fix all instances found in Phase 3
2. Run tests
3. Run the `sync-graph` skill if the traversal shape changed
4. Note in the PR: "Pattern sweep done — found N additional instances" or "Pattern sweep not done — [reason]"

---

## Report format

After debugging, summarize:

```
Bug: [one-line description]
Root cause: [file:function — what was wrong]
Pattern sweep: [N total instances found, M fixed]
Files changed: [list]
Tests: [which tests verify the fix]
```

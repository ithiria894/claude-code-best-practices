---
name: debug
description: Debug a bug from report to fix. Locates the layer, finds root cause, sweeps for same pattern elsewhere, then fixes. Use when given a bug report, error message, or "X is broken".
---

> **[codebase-navigator plugin — debug skill]**

# Debug

Find the layer where the data goes wrong, fix it there, then check if the same pattern exists elsewhere.

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
- `Docs:` field — if the domain has linked documentation, **read it before tracing code**. Domain docs contain business logic, caveats, and design decisions that code alone won't tell you.

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

If the file is large (500+ lines) or the pattern might repeat across many files, hand off to Codex CLI:

```bash
codex exec "Scan [file/directory] for all instances of [pattern].
For each query/function, output: LINE | FUNCTION | STATUS (OK or MISSING [field])."
```

Codex is 10-50x cheaper than Claude for brute-force scanning and catches every instance.

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
3. `/sync-graph` — update the graph while you still remember what changed
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

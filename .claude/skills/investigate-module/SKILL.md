---
name: investigate-module
description: Investigate one module with minimal context waste. Use when you need to understand a specific module before making changes — reads minimum files, returns exact sources read, never infers from index alone.
disable-model-invocation: true
---

# Investigate Module

Investigate a specific module or feature with minimal context waste. Do not implement anything yet.

---

## Rules

- Do not answer from memory.
- Do not infer behavior from AI_INDEX.md alone.
- Before making any claim, name the exact file and function you read.
- If uncertain, say "uncertain" — do not guess.

---

## Step 1 — Read AI_INDEX.md

Find the repo's AI_INDEX.md and read it as a navigation map only.

- Identify which domain section is relevant to the current task.
- Note the entry files and search terms listed.
- Do not treat any description in the index as ground truth.

---

## Step 2 — Locate with grep/glob first

Before opening any file, search for the relevant symbol or keyword:

```
grep: <search_term from index>
glob: src/**/<filename pattern>
```

Use the index's "Search terms" to guide this. Only open files that appear in results.

---

## Step 3 — Read minimum files

Open only the files and functions/classes relevant to the current task.

- Do not read entire files if you only need one function.
- If a file is large, read only the relevant section by line range.
- Do not open files "just in case".

---

## Step 4 — Return findings

Return exactly:

```
Files read:
- <path>:<line range or function name>

Functions / classes read:
- <function or class name> in <file>

Uncertain parts:
- <anything you could not confirm from source>
```

Do not include conclusions that go beyond what you directly read.

---

## For complex investigations: use a subagent

When the module spans many files or the task is exploratory, delegate to a subagent instead of reading in the main thread:

> Use a subagent to investigate this module first.
> Treat AI_INDEX.md as navigation only.
> Read the minimum number of files needed.
> Return exact files/functions read.
> Do not implement yet.
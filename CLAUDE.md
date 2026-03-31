# CLAUDE.md Template

> Copy this into your project root. Fill in the sections marked with [].
> Target: under 200 lines. Every bullet = one instruction slot. Budget wisely.

---

## Project

[One sentence: what does this codebase do?]

**Stack:** [e.g. Python / FastAPI / SQLAlchemy / PostgreSQL]

**Key domains:** [e.g. auth, billing, notifications — just the names]

---

<investigate_before_answering>
Never speculate about code you have not opened.
Check AI_INDEX.md first — navigation only, not source of truth.
grep/glob to locate the exact file and function before reading.
Read only the relevant section — use line ranges, not whole files.
Name what you read: "Based on src/foo.py:bar()..."
If uncertain: say "uncertain" — do not guess.
Read each file once. No redundant reads.
For broad exploration across many files: use a subagent.
</investigate_before_answering>

---

## Common pitfalls

> These are the highest-ROI lines in this file. Each one prevents a 10–30 min debugging cycle.

- [e.g. Never use `db.session` directly in routes — use dependency injection]
- [e.g. Always scope queries to `tenant_id` — missing this is a data leak]
- [e.g. Don't mock the DB in tests — use fixtures with real transactions]
- [Add your own from experience]

---

## Commands

```bash
# Run tests
[e.g. pytest tests/ -x]

# Lint
[e.g. ruff check . && mypy src/]

# Start dev server
[e.g. uvicorn main:app --reload]
```

---

## Autonomy

The rule is reversibility. Ask only before irreversible or externally-visible actions.

**Never ask before:** editing files, running tests, grep, git add, git commit on a feature branch.  
**Always ask before:** push to remote, publish, deleting files, force operations, sending messages.

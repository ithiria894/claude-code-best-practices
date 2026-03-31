# MEMORY.md Template

> This is the index file for Claude Code's auto-memory system.
> Stored at: ~/.claude/projects/<project-hash>/memory/MEMORY.md
> First 200 lines are loaded every session. Keep it as a pointer index — not a knowledge base.

---

# Memory Index — [Project Name]

## User
- [user_profile.md](user_profile.md) — [One-line description of the developer's context]

## Feedback
- [feedback_example.md](feedback_example.md) — [What the rule is — one line, specific]

## Project
- [project_current_work.md](project_current_work.md) — [What's in progress, with absolute dates]

## Reference
- [reference_environment.md](reference_environment.md) — [Where to find environment-specific info]

---

## How to write memory files

Each memory file uses this frontmatter:

```markdown
---
name: Short name for this memory
description: One-line description — used to decide relevance in future conversations
type: user | feedback | project | reference
---

[Content here]
```

**Feedback files** (most important — save after every correction or validation):
```markdown
---
name: Don't mock the database in tests
description: Integration tests must use real DB — mock/prod divergence caused a broken migration
type: feedback
---

Use real DB fixtures in all tests. No mocking.

**Why:** Prior incident where mock tests passed but the prod migration failed silently.
**How to apply:** When writing any test that touches data, use the real test DB with factory fixtures.
```

**Project files:**
```markdown
---
name: Feature X progress
description: 6-PR feature, PR1-3 merged, next is PR4 (worker migration)
type: project
---

Feature X is being built across 6 PRs.
- PR1 (merged): Schema changes
- PR2 (merged): Service layer
- PR3 (merged): API endpoints
- PR4 (in progress): Worker migration — target: 2026-04-15

**Why:** Splitting avoids large review surface. Each PR is independently deployable.
**How to apply:** When resuming this feature, start by reading PR4 description.
```

---

## What NOT to save in memory

- Code patterns, file paths, architecture — derive from source
- Git history — use `git log`
- Anything already in CLAUDE.md
- Debugging solutions — the fix is in the code; the commit has the context
- In-progress task state — use TodoWrite instead

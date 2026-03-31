# Context Management

Claude Code's context window fills fast — and performance degrades as it fills. Claude may start "forgetting" earlier instructions, skipping details, or making mistakes before you even notice the context is full.

This is the single most important constraint to design around.

---

## The core rule: context is not free

Every file read, every tool result, every message adds to context. Once it's in, you can't take it back without clearing. The goal is to spend context on things that matter, not on exploration noise.

---

## Four practices

### 1. `/clear` between unrelated tasks

If you just finished debugging a payment bug and now want to add a new API endpoint — clear first. Carrying the previous task's file reads and reasoning into the next task burns context on irrelevant material.

```
/clear
```

No information is lost that matters: your code changes are saved to disk. The only thing lost is conversation history you don't need anymore.

### 2. `/compact` with a focus keyword — not blind compaction

When context is filling but you're mid-task, compact with a hint so Claude preserves the right information:

```
/compact focus on the auth migration changes
```

Without the focus keyword, compaction summarizes everything equally. With it, the relevant parts are preserved and noise is dropped.

### 3. Write state to files, not conversation

For any task that spans more than ~10 messages, write the plan and progress to a file:

```markdown
# PLAN.md
## Goal
Add rate limiting to the API

## Steps
- [x] Add Redis connection
- [ ] Implement middleware
- [ ] Add tests
- [ ] Update docs

## Decisions
- Using token bucket algorithm (not leaky bucket) because...
```

When context fills and you `/clear`, you hand Claude the PLAN.md and continue — no context lost.

This also works across sessions. Plans survive context resets. Conversation history doesn't.

### 4. One task per session — or explicit boundary

The longer a session runs, the more context residue accumulates. Unrelated tool results, file reads from earlier work, abandoned exploration — all still in context, all still influencing responses.

For long work sessions: treat each major task as a fresh start. Clear between them. It's not a cost — it's a reset to full performance.

---

## Signs your context is getting full

- Claude starts repeating itself or forgetting earlier constraints
- Responses get slower and less precise
- Claude starts making obvious mistakes on things it got right earlier
- Instructions from CLAUDE.md start being ignored

When you see these: `/compact` first, `/clear` if still degraded.

---

## What this looks like in practice

```
Session start: /clear (or fresh window)
↓
Read AI_INDEX.md → find relevant domain
↓
grep/LSP to locate exact file
↓
Read minimum section needed
↓
Make changes
↓
[If long task: write progress to PLAN.md]
↓
[If switching to unrelated work: /clear]
```

---

## Sources

- Anthropic official Claude Code docs: `/clear`, `/compact`, context management
- Community research: strongest consensus topic across r/ClaudeCode (multiple independent reports)
- HumanLayer: context compaction degrades CLAUDE.md rule priority (rules get re-wrapped with "may or may not be relevant")

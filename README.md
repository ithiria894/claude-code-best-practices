# Claude Code Best Practices

A living collection of battle-tested patterns for using Claude Code on real codebases — built from research, source code analysis, and hands-on experience.

**Core problem this solves:**
- Read too little → Claude guesses → hallucinations
- Read too much → context fills → session degrades, costs explode

Every technique here has a cited source or is derived from first-principles analysis. No vibes-based suggestions.

---

## Contents

| | |
|---|---|
| [Investigation system](#investigation-system-aiindex--lsp--skills) | AI_INDEX + LSP + skills — how Claude finds what it needs |
| [CLAUDE.md configuration](#claudemd-configuration) | XML tags, instruction budget, hard rules |
| [Autonomy rules](#autonomy-rules) | When to ask, when to just do it |
| [Context management](#context-management) | /clear, /compact, writing state to files |
| [Templates and skills](#templates-and-skills) | Copy-paste ready files |

---

## Investigation system: AI_INDEX + LSP + skills

These three work together as one system. AI_INDEX tells Claude where to start. LSP finds exactly what's connected. The skills run the workflow.

### AI_INDEX.md — one per repo, the first thing Claude reads

Every repo gets one `AI_INDEX.md` in its root. When Claude starts work on a codebase, this is the first file it navigates to — not a source file, not a README. The index.

Its only job: tell Claude *where to look*, not *how the code works*. Think airport signage. The sign points to Gate 12 — it doesn't explain how the plane flies.

```markdown
# AI_INDEX.md

## How to use this file
- Navigation only. Not source of truth.
- Read actual source files before making any claim.

## Main domains

### Rule evaluation
- Entry: src/rule_evaluator.py
- Search: evaluate_rule, ActionExecutor
- Tests: tests/test_rule_evaluator.py
- Connects to:
  - Content layer — via ActionExecutor.execute()
  - API layer — via POST /api/evaluate (src/api/routes.py)
```

The `Connects to` section is critical. It maps the edges between domains without explaining how they work. When `/trace-impact` runs BFS outward from a changed symbol, it uses these connections to cross domain boundaries.

**Healthy index:** under 250 lines, 4–8 lines per domain, file paths and grep terms only, says "not source of truth".

**Needs rewriting:** prose descriptions, data flow summaries, edge case conclusions, words like "usually" or "roughly" — anything Claude could use to answer a question without reading source. That's how confident hallucinations happen.

See [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) for the full format.

---

### LSP — required install

LSP (Language Server Protocol) is how Claude finds every place a symbol is used — callers, imports, implementations. The skills rely on it. Without LSP, Claude falls back to grep.

| | grep | LSP findReferences |
|---|---|---|
| Speed | baseline | 900x faster |
| Token cost | high | 20x lower |
| Accuracy | string match, false positives | semantic, zero false positives |

Enable in `settings.json`:
```json
{ "env": { "ENABLE_LSP_TOOL": "1" } }
```

Install for your stack:
```bash
pip install python-lsp-server                         # Python
npm install -g typescript-language-server typescript  # TypeScript
go install golang.org/x/tools/gopls@latest            # Go
```

---

### The two skills

**`/investigate-module`** — Use before making any claim about a module you haven't read.

Workflow: reads AI_INDEX to find the domain → grep/LSP to locate the exact file and function → reads only the relevant section (line range, not whole file) → returns exactly what it read so you can verify.

Never reads the whole codebase. Never guesses. If it can't find something, it says uncertain.

---

**`/trace-impact`** — Use before adding a feature or fixing a bug.

Workflow: starts at the changed symbol → LSP findReferences for direct callers (Level 1) → findReferences on each caller for indirect callers (Level 2) → checks AI_INDEX `Connects to` for cross-domain paths → finds affected tests.

Stops when it hits an external API boundary, a stable interface contract, or 3+ hops from the origin. Reports: must change / might change / tests to verify / uncertain.

Coding is a web — change one thing and something connected breaks. This skill maps the web before you touch anything.

---

### How they work together

```
Task: fix a bug in rule_evaluator.py

1. /trace-impact rule_evaluator.py:evaluate_rule
   → finds callers, cross-domain connections, affected tests
   → you now know the full blast radius

2. /investigate-module for any caller you need to understand
   → reads only the relevant function, names the source
   → you now have grounded facts, not guesses

3. Make the change
   → you already know what else needs updating
   → no surprises
```

---

## CLAUDE.md configuration

### XML tags survive context pressure

Anthropic injects your CLAUDE.md with: *"this context may or may not be relevant."* Under load, markdown headings get deprioritized. XML tags don't — they're a high-priority structure in Claude's training.

```xml
<investigate_before_answering>
Never speculate about code you have not opened.
Check AI_INDEX.md first — navigation only, not source of truth.
grep/LSP to locate the exact file and function before reading.
Read only the relevant section — use line ranges, not whole files.
Name what you read: "Based on src/foo.py:bar()..."
If uncertain: say "uncertain" — do not guess.
Read each file once. No redundant reads.
</investigate_before_answering>
```

### Instruction budget: ~150 slots total

Claude has roughly 150–200 instruction slots. The system prompt uses ~50. Every bullet point in your CLAUDE.md is one slot. A bloated CLAUDE.md doesn't just waste space — it degrades all rules simultaneously.

Keep CLAUDE.md under 200 lines. Put the highest-ROI content first: common pitfalls that prevent specific bugs, not general guidance.

### Hard rules belong in settings.json, not CLAUDE.md

CLAUDE.md is advisory — Claude can ignore it under pressure. `settings.json` deny rules are enforced regardless of context:

```json
{
  "permissions": {
    "deny": [
      "Bash(git push --force*)",
      "Bash(rm -rf*)"
    ]
  }
}
```

If you find yourself writing `NEVER do X` in CLAUDE.md, move it to `settings.json` deny.

See [`CLAUDE.md`](CLAUDE.md) template and [`docs/verification-prompting.md`](docs/verification-prompting.md) for the full verification rule patterns.

---

## Autonomy rules

The rule is reversibility. Not action type, not perceived risk — reversibility.

**Never ask before:** editing files, running tests, grep, installing packages, git add, git commit on a feature branch. All reversible.

**Always ask before:** push to remote, publish packages, delete files, force operations, sending messages externally. Irreversible or visible to others.

On a feature branch, everything up to and including commit is reversible. Push is the line.

---

## Context management

Context fills fast. Performance degrades as it fills — Claude starts skipping details, forgetting earlier instructions, making obvious mistakes.

Key practices:
- **`/clear` between unrelated tasks** — context residue from one task degrades the next
- **`/compact focus on X`** — compact with a hint, not blindly
- **Write state to `PLAN.md`** — task progress survives a `/clear`; conversation history doesn't
- **One task per session** — treat each major task as a fresh start

Full guide: [`docs/context-management.md`](docs/context-management.md)

---

## Quick start

Copy this prompt into Claude Code in your project:

```
Read these files from https://github.com/ithiria894/claude-code-best-practices:
- README.md
- .claude/skills/investigate-module/SKILL.md
- .claude/skills/trace-impact/SKILL.md
- templates/AI_INDEX_TEMPLATE.md
- CLAUDE.md

Then explain each component to me in plain language:
1. What /investigate-module does and when to use it
2. What /trace-impact does and when to use it
3. What AI_INDEX.md is and what I need to write for this repo
4. What the <investigate_before_answering> rule does in CLAUDE.md
5. What enabling LSP means and what to install for this project's stack

After explaining, ask me which ones I want to set up. Install only what I confirm.
Do not install anything before asking.
```

---

## Templates and config

| File | What it is |
|---|---|
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | Full AI_INDEX format with Connects to |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory file structure and frontmatter |
| [`CLAUDE.md`](CLAUDE.md) | CLAUDE.md template with XML verification rules |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook scaffold |

---

## Contributing

This is a living document. New best practices added as they're validated in real use.

Rules:
- Every technique must cite a source or explain the first-principles reasoning
- No "just add this" without explaining why it works
- Failure cases are as valuable as success patterns

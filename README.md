# Claude Code Best Practices

A living collection of battle-tested patterns for using Claude Code on real codebases — built from research, source code analysis, and hands-on experience.

**Core problem this solves:**
- Read too little → Claude guesses → hallucinations
- Read too much → context fills → session degrades, costs explode

Every technique here has a cited source or is derived from first-principles analysis. No vibes-based suggestions.

---

## Start here: the two skills

These are the core workflow. Install them first.

**`/investigate-module`** — Before making any claim about a module you haven't read yet. Navigates via AI_INDEX, locates the exact file/function with grep or LSP, reads only the relevant section. Returns exactly what it read so you can verify.

**`/trace-impact`** — Before adding a feature or fixing a bug. Does BFS outward from the changed symbol: direct callers → indirect callers → cross-domain connections → affected tests. Stops at domain boundaries. Tells you everything that needs to change before you touch a line.

```bash
cp -r .claude/skills/ your-project/.claude/skills/
```

---

## What's inside

| File / Folder | What it is |
|---|---|
| [`.claude/skills/investigate-module/`](.claude/skills/investigate-module/SKILL.md) | **Core skill** — single module investigation |
| [`.claude/skills/trace-impact/`](.claude/skills/trace-impact/SKILL.md) | **Core skill** — BFS impact analysis |
| [`CLAUDE.md`](CLAUDE.md) | Template with XML-wrapped verification rules |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook scaffold |
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | How to write AI_INDEX for your repo |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory file structure |
| [`docs/best-practices.md`](docs/best-practices.md) | Full guide with research sources |
| [`docs/context-management.md`](docs/context-management.md) | `/clear`, `/compact`, writing state to files |
| [`docs/verification-prompting.md`](docs/verification-prompting.md) | Phrases that force Claude to verify before answering |

---

## The five principles

### 1. AI_INDEX.md — one per repo, the first thing Claude reads

Every repo gets one `AI_INDEX.md` in the root. It's the first file Claude navigates to when starting work on that codebase. Not the last — the first.

Its job: tell Claude *where to look*, not *how the code works*. Think airport signage, not architecture docs.

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

The `Connects to` section is what makes cross-feature work possible. When you run `/trace-impact`, it uses these connections to cross domain boundaries without BFS-ing blindly through every file.

**Keep if:** under 250 lines, 4–8 lines per module, no inference language, says "not source of truth".  
**Rewrite if:** prose descriptions, data flow summaries, edge case conclusions — anything Claude could use to answer without reading source.

See [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) for the full format.

---

### 2. LSP — required install, not optional

LSP (Language Server Protocol) is how Claude finds every place a symbol is used — callers, imports, implementations. Without it, Claude falls back to grep.

| | grep | LSP findReferences |
|---|---|---|
| Speed | baseline | 900x faster |
| Token cost | high | 20x lower |
| Accuracy | string match, false positives | semantic, zero false positives |

The difference matters most for `/trace-impact`. With grep, finding all callers of a function means reading hundreds of noisy results. With LSP, you get a precise list in milliseconds.

**Enable in `settings.json`:**
```json
{ "env": { "ENABLE_LSP_TOOL": "1" } }
```

**Install for your stack:**
```bash
pip install python-lsp-server                         # Python
npm install -g typescript-language-server typescript  # TypeScript
go install golang.org/x/tools/gopls@latest            # Go
```

---

### 3. CLAUDE.md rules need XML tags to survive context pressure

Anthropic injects your CLAUDE.md with: *"this context may or may not be relevant."* Under load, markdown headings get deprioritized. XML tags don't — they're a high-priority structure in Claude's training.

Also: Claude has roughly 150–200 instruction slots total (the system prompt already uses ~50). Every bullet point is one slot. A bloated CLAUDE.md degrades *all* rules simultaneously — not just the ones at the end.

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

Hard rules (things Claude must never do) belong in `settings.json` deny — not CLAUDE.md. CLAUDE.md is advisory. `settings.json` is enforced.

---

### 4. Reversibility = the only autonomy criterion

Don't judge actions by category. Judge by reversibility.

**Never ask before:** editing files, running tests, grep, installing packages, git add, git commit on a feature branch — all reversible.  
**Always ask before:** push to remote, publish packages, delete files, force operations — irreversible or visible to others.

On a feature branch, everything up to and including commit is reversible. Push is the line.

---

### 5. Subagents for exploration, main thread for decisions

Claude Code's main context fills fast. Exploration (reading multiple files to understand something) should run in a subagent — isolated context window, clean result handed back.

The `/investigate-module` and `/trace-impact` skills handle this automatically. For ad-hoc subagent delegation:

```
Use a subagent to investigate [module].
Treat AI_INDEX.md as navigation only.
Read minimum files needed.
Return exact files/functions read.
Do not implement yet.
```

---

## Quick start

```bash
# 1. Copy skills and config
cp -r .claude/ your-project/

# 2. Install language server (required for /trace-impact to work properly)
pip install python-lsp-server            # Python
npm install -g typescript-language-server typescript  # TypeScript

# 3. Write your AI_INDEX
cp templates/AI_INDEX_TEMPLATE.md your-project/AI_INDEX.md
# Fill in domains: entry files, search terms, Connects to — no explanations

# 4. Add verification rule to your CLAUDE.md
# Copy the <investigate_before_answering> block from CLAUDE.md template

# 5. Use the skills
# Before investigating any module:  /investigate-module
# Before any feature or bugfix:     /trace-impact
```

---

## Further reading

- [`docs/context-management.md`](docs/context-management.md) — when to `/clear`, when to `/compact`, writing state to files
- [`docs/verification-prompting.md`](docs/verification-prompting.md) — specific phrases that force Claude to verify before answering
- [`docs/best-practices.md`](docs/best-practices.md) — full explanation with all research sources

---

## Contributing

This is a living document. New best practices added as they're validated in real use.

Rules:
- Every technique must cite a source or explain the first-principles reasoning
- No "just add this" without explaining why it works
- Failure cases are as valuable as success patterns

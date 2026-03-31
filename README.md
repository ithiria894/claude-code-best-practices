# Claude Code Best Practices

A living collection of battle-tested patterns for using Claude Code on real codebases — built from research, source code analysis, and hands-on experience.

**Core problem this solves:**
- Read too little → Claude guesses → hallucinations
- Read too much → context fills → session degrades, costs explode

Every technique here has a cited source or is derived from first-principles analysis. No vibes-based suggestions.

---

## What's inside

| File / Folder | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Ready-to-use template with XML-wrapped verification rules |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook scaffold |
| [`.claude/skills/investigate-module/`](.claude/skills/investigate-module/SKILL.md) | Investigate one module with minimum token cost |
| [`.claude/skills/trace-impact/`](.claude/skills/trace-impact/SKILL.md) | BFS impact analysis for features and debugging |
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | Routing manifest format — how to write AI_INDEX correctly |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory file structure template |
| [`docs/best-practices.md`](docs/best-practices.md) | Full explanation with research sources |

---

## The five principles

### 1. AI_INDEX = routing manifest, not a design doc

Write AI_INDEX like airport signage — it points to the gate, it doesn't explain how the plane works.

```markdown
### Rule evaluation
- Entry: src/rule_evaluator.py
- Search: evaluate_rule, ActionExecutor
- Tests: tests/test_rule_evaluator.py
- Connects to:
  - Content layer — via ActionExecutor.execute()
  - API layer — via POST /api/evaluate (src/api/routes.py)
```

When AI_INDEX contains execution flow summaries or edge case conclusions, Claude reasons from the index instead of reading source. That's how hallucinations happen.

**Keep if:** under 250 lines, 4–8 lines per module, no inference language ("usually", "roughly"), explicitly says "not source of truth".  
**Rewrite if:** you see long prose, data flow descriptions, or anything Claude could use to answer without reading the actual files.

---

### 2. CLAUDE.md rules need XML tags to survive context pressure

Anthropic injects your CLAUDE.md with: *"this context may or may not be relevant."* Under load, markdown headings get deprioritized. XML tags don't — they're a high-priority structure in Claude's training.

Also: Claude has roughly 150–200 instruction slots total (the system prompt uses ~50). Every bullet point is one slot. A bloated CLAUDE.md degrades *all* rules, not just the ones at the end.

```xml
<investigate_before_answering>
Never speculate about code you have not opened.
Check AI_INDEX first — navigation only, not source of truth.
Read only the relevant section — use line ranges, not whole files.
Name what you read: "Based on src/foo.py:bar()..."
If uncertain: say "uncertain" — do not guess.
Read each file once. No redundant reads.
</investigate_before_answering>
```

Hard rules (things Claude must never do) belong in `settings.json` deny, not CLAUDE.md. CLAUDE.md is advisory. `settings.json` is enforced.

---

### 3. LSP > grep for impact analysis

When you change a function, you need every caller. grep is string matching: slow, noisy, token-hungry, false positives. LSP `findReferences` is semantic: 900x faster, 20x fewer tokens, zero false positives.

```json
{ "env": { "ENABLE_LSP_TOOL": "1" } }
```

```bash
pip install python-lsp-server                         # Python
npm install -g typescript-language-server typescript  # TypeScript
go install golang.org/x/tools/gopls@latest            # Go
```

---

### 4. Reversibility = the only autonomy criterion

Don't judge actions by type. Judge by reversibility.

**Never ask before:** editing files, running tests, grep, installing packages, git add, git commit on a feature branch — all reversible.  
**Always ask before:** push to remote, npm publish, deleting files, force operations — irreversible or visible to others.

On a feature branch, everything up to and including commit is reversible. Push is the line.

---

### 5. Subagents for exploration, main thread for decisions

Claude Code's main context fills fast and performance degrades as it fills. Exploration (reading multiple files to understand a module) should run in a subagent — isolated context, clean result handed back.

Use `/investigate-module` for single-module investigation.  
Use `/trace-impact` for full BFS impact analysis before any non-trivial change.

---

## Quick start

```bash
# 1. Copy config into your project
cp -r .claude/ your-project/

# 2. Install language server for your stack
pip install python-lsp-server
npm install -g typescript-language-server typescript

# 3. Write your AI_INDEX
cp templates/AI_INDEX_TEMPLATE.md your-project/AI_INDEX.md
# Fill in your domains — file paths and grep keywords only, no explanations

# 4. Use the skills
# /investigate-module — before making any claim about a module
# /trace-impact — before adding a feature or fixing a bug
```

---

## Contributing

This is a living document. New best practices get added as they're validated in real use.

Rules for contributions:
- Every technique must cite a source or explain the first-principles reasoning
- No "just add this" without explaining why it works
- Failure cases are as valuable as success patterns — document what went wrong

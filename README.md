# Claude Code Best Practices

[繁體中文](README.zh-TW.md)

You ask Claude about a function. It gives you a confident, detailed explanation.

You build on it for an hour. Then you find out it was wrong.

---

Or this one: you change a function, Claude helps you finish it, tests pass, you ship. Three days later in code review someone says "hey, four other places call this function — they're all broken." Claude never mentioned them. You didn't know to ask.

This happens all the time on real projects. Same root cause every time: **Claude doesn't have a way to navigate your codebase.** It reads too little and guesses, or reads too much and burns your tokens before getting to the actual work.

Here's how to fix it.

---

## The core idea

**Turn your entire repo into a graph. Use BFS + LSP to search and traverse it.**

That's the whole thing. The bottleneck for AI coding assistants isn't intelligence — it's navigation. Claude can reason well once it has the right information. The problem is it wastes most of its capacity *finding* that information.

```
/generate-index          → build the graph (deterministic script + Claude refine)
        ↓
    AI_INDEX.md          → the graph itself (adjacency list — nodes are domains, edges are connections)
        ↓
/investigate-module      → read a specific node (grounded, with sources)
/trace-impact            → BFS along the edges (find everything a change affects)
```

Drop a bug or a feature request anywhere on this graph, and the system traces every connected path to find what's affected — before you write a single line of code.

---

## AI_INDEX.md — not a file list, a graph

There are dozens of AI_INDEX templates out there. Most look like this:

```
auth → src/auth/
api  → src/api/
db   → src/models/
```

That's a flat file list. Claude knows where to find things, but it has no idea that changing `auth` will break `api`. There's no structure connecting them. It's a phonebook, not a map.

Our AI_INDEX is a **graph data structure** — specifically an adjacency list:

```markdown
### Auth
- Entry: src/auth/middleware.py
- Search: verifyToken, AuthError
- Tests: tests/test_auth.py
- Connects to:
  - API layer — via requireAuth() in src/api/routes.py
  - DB layer — via UserModel.findById() in src/models/user.py

### API layer
- Entry: src/api/routes.py
- Search: router, handleRequest
- Tests: tests/test_routes.py
- Connects to:
  - Auth — via requireAuth middleware
  - Rule evaluation — via POST /api/evaluate
```

Every domain is a **node**. Every `Connects to` is an **edge**. That's what makes `/trace-impact` possible — it's a BFS traversal on this graph. Without edges, you have a directory listing. With them, you have a network that an algorithm can walk.

The edges come from real imports, not guessing. `/generate-index` scans your actual import statements to build the graph. It doesn't infer — it reads.

One rule: keep it under 250 lines, pointers only. The moment it starts explaining *how* things work instead of *where* they are, Claude reasons from the index instead of reading source code. That's where the confident wrong answers come from.

**Keeping it fresh:** A stale graph is worse than no graph — Claude trusts it and follows dead paths. After structural changes (new modules, renamed files, new connections), re-run `/generate-index`.

See [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md).

---

## LSP — the search engine for the graph

BFS needs precise lookups at each node. grep can't do this — it's string matching, so `authenticate` matches comments, variable names, and unrelated files. 40 results, 15 noise, half your token budget gone.

LSP asks the language's type checker directly. Semantic, not string. Same query, 6 exact results.

| | grep | LSP findReferences |
|---|---|---|
| Speed | baseline | 900x faster |
| Token cost | high | 20x lower |
| Accuracy | string match, false positives | semantic, zero false positives |

Enable in `.claude/settings.json`:
```json
{ "env": { "ENABLE_LSP_TOOL": "1" } }
```

**VS Code**: language servers already running — just enable the flag. **Terminal**: install the server for your language first:

```bash
pip install python-lsp-server                         # Python
npm install -g typescript-language-server typescript  # TypeScript
go install golang.org/x/tools/gopls@latest            # Go
```

---

## The three skills

**`/generate-index`** — build the graph automatically

Scans your imports, directory structure, and exported symbols. Outputs the full AI_INDEX.md with all `Connects to` edges filled in from actual import statements. Deterministic — 80% of the graph is built with zero tokens. Claude refines the last 20% (HTTP endpoints, frontend-backend connections the script can't see).

Run once on a new repo. Re-run when the structure changes.

---

**`/investigate-module`** — verification-first prompting

The key mechanism: **forces Claude to name the exact file and function it read before making any claim.** This eliminates the middle ground of confident fabrication — Claude either reads the source (and is accurate) or says "uncertain" (and you know to dig deeper).

Reads AI_INDEX to find the right node → grep/LSP to locate the exact symbol → reads only the relevant lines → reports what it read so you can verify.

---

**`/trace-impact`** — BFS traversal on the graph

This is where the graph pays off. Instead of hoping you remembered every caller, `/trace-impact` does a systematic breadth-first search on the AI_INDEX adjacency list:

- **Level 0**: the node you're changing
- **Level 1**: direct callers (LSP findReferences — semantic, not grep)
- **Level 2**: callers of those callers
- **Cross-domain**: follows `Connects to` edges across module boundaries
- **Tests**: every test covering the affected set

Breadth-first so you see all direct impact before going deeper. Stops at API boundaries. Nothing slips through.

---

### How they work together

```
New repo:
  /generate-index → builds the map with all connections

Fix a bug:
  1. /trace-impact rule_evaluator.py:evaluate_rule
     → know the full blast radius before touching anything
  2. /investigate-module for any part you need to understand
     → grounded facts with sources, not guesses
  3. Make the change
     → you already know what else needs updating

Add a feature:
  1. /trace-impact on each touch point → map the blast radius first
  2. /investigate-module for domains you don't understand
  3. Implement the feature
  4. /generate-index if you added new modules or connections
```

---

## CLAUDE.md — XML tags, not markdown

Rules in CLAUDE.md get deprioritized under context pressure — Anthropic wraps them with *"this context may or may not be relevant."* XML tags survive this better:

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

**Instruction budget:** ~150–200 slots total. System prompt uses ~50. Every bullet in CLAUDE.md is one slot. Over budget = all rules degrade simultaneously. Keep it under 200 lines.

**Hard rules → `settings.json` deny**, not CLAUDE.md. CLAUDE.md can be overridden under pressure. Deny rules cannot:

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

---

## Autonomy — reversibility, not action type

**Never ask:** edit files, run tests, grep, git add, git commit on feature branch — all reversible.
**Always ask:** push to remote, publish, delete files, force operations — irreversible or visible to others.

Push is the line.

---

## Context management

- **`/clear` between unrelated tasks** — context residue degrades the next task
- **`/compact focus on X`** — directed compaction, not blind
- **Write state to `PLAN.md`** — survives `/clear`; conversation history doesn't
- **One major task per session** — fresh start = full performance

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

Then explain each component to me by starting with the pain point it solves —
what frustrating thing happens without it, why it happens, and how this fixes it.
Use plain language. Be specific. I should be able to say "yes that happens to me" before you explain the solution.

Explain these five:
1. /investigate-module — what goes wrong when Claude answers questions about code it hasn't actually read
2. /trace-impact — what goes wrong when you change something and don't know what else breaks
3. AI_INDEX.md — why Claude gets confused or slow on a codebase it hasn't seen, and what the index does about it
4. The <investigate_before_answering> CLAUDE.md rule — why telling Claude "be careful" doesn't work, and what does
5. LSP — why searching for code with grep wastes tokens and causes mistakes, and what LSP does differently

After explaining all five, ask me which ones I want to set up.
Install only what I confirm. Do not install anything before asking.
```

---

## Templates and config

| File | What it is |
|---|---|
| [`scripts/generate-ai-index.mjs`](scripts/generate-ai-index.mjs) | Deterministic AI_INDEX generator — scans imports, outputs routing manifest |
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | Full AI_INDEX format with Connects to |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory file structure and frontmatter |
| [`CLAUDE.md`](CLAUDE.md) | CLAUDE.md template with XML verification rules |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook scaffold |

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

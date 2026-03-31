# Claude Code Best Practices

[繁體中文](README.zh-TW.md)

You ask Claude about a function. It gives you a confident, detailed explanation.

You build on it for an hour. Then you find out it was wrong.

---

Or this one: you change a function, Claude helps you finish it, tests pass, you ship. Three days later in code review someone says "hey, four other places call this function — they're all broken." Claude never mentioned them. You didn't know to ask.

This happens all the time on real projects. Same root cause every time: **Claude doesn't have a way to navigate your codebase.** It reads too little and guesses, or reads too much and burns your tokens before getting to the actual work.

Here's how to fix it.

---

## The core insight

The bottleneck for AI coding assistants isn't intelligence — it's navigation. Claude can reason well once it has the right information. The problem is it wastes most of its capacity *finding* that information.

Three skills solve this:

```
/generate-index          → build the map (deterministic script + Claude refine)
        ↓
    AI_INDEX.md          → the map itself (routing manifest with Connects to edges)
        ↓
/investigate-module      → read a specific node on the map (grounded, with sources)
/trace-impact            → BFS along the edges (find everything affected by a change)
```

The map is a web of every domain in your codebase and how they connect. Drop a bug or a feature request anywhere on that web, and the system traces every path that's affected — before you write a single line of code.

---

## AI_INDEX.md — give Claude a map

Every new session, you spend 10 minutes re-orienting Claude. "The auth logic is in... the routes are in... the models are..." Claude asks questions it shouldn't have to ask. It reads the wrong files. It explains code it hasn't even opened.

What if Claude read one file first that just tells it where everything is?

That's AI_INDEX.md. You put it in your repo root. Claude reads it before anything else. It's not a design doc — it doesn't explain how your code works. It's airport signs. Gate 12 is this way. Just that.

```markdown
### Rule evaluation
- Entry: src/rule_evaluator.py
- Search: evaluate_rule, ActionExecutor
- Tests: tests/test_rule_evaluator.py
- Connects to:
  - Content layer — via ActionExecutor.execute()
  - API layer — via POST /api/evaluate (src/api/routes.py)
```

The `Connects to` part matters a lot. When you're tracing what breaks after a change, these connections tell Claude which other domains to check — without reading every file in between.

One thing to keep in mind: the moment this file starts explaining *how* things work instead of *where* they are, Claude will start reasoning from the index instead of reading the actual code. That's where the confident wrong answers come from. Keep it under 250 lines, file paths and keywords only.

**Generating it:** You don't have to write this by hand. The repo includes a script that scans your imports and directory structure and outputs the whole thing:

```bash
node scripts/generate-ai-index.mjs src tests > AI_INDEX.md
```

It finds entry files, extracts exported symbols as search terms, and maps cross-domain connections from actual imports. Gets you 80% of the way there — then you review and add anything it missed (like HTTP endpoints or frontend-backend connections).

**Keeping it fresh:** A stale map is worse than no map — Claude trusts it and follows dead paths. After every bug fix or feature that changes the structure (new modules, renamed files, new cross-domain connections), re-run the generator or update the affected entries manually. You can enforce this with a CLAUDE.md rule, a pre-commit hook, or just discipline — pick whatever works for your team.

See [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md).

---

## LSP — not grep

You ask Claude to find every place a function is called. It uses grep. Sounds fine.

But grep is string matching — it finds those letters anywhere they appear. Comments. Variable names that happen to contain the string. Files from a completely unrelated part of the codebase. You ask for callers of `authenticate()` and get 40 results. 15 are noise. Claude reads all 40. Half your token budget gone before you've made a single change.

LSP asks the language's type checker instead. It knows what the symbol actually *is*, not just where the letters appear. Same query, 6 exact results. The real callers, nothing else.

| | grep | LSP findReferences |
|---|---|---|
| Speed | baseline | 900x faster |
| Token cost | high | 20x lower |
| Accuracy | string match, false positives | semantic, zero false positives |

Enable in `.claude/settings.json`:
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

## The three skills

**`/generate-index`** — build the map

You can write AI_INDEX.md by hand, but for any repo with more than a handful of files, let the script do the heavy lifting. It scans your source directory, finds every import between files, and outputs the routing manifest with all the `Connects to` edges already filled in.

```bash
node scripts/generate-ai-index.mjs src tests > AI_INDEX.md
```

Then Claude reviews the output — adds HTTP endpoints, merges domains that should be together, trims noise. Script does 80% deterministically (zero tokens). Claude refines the last 20%.

Run it once when you set up a new repo, then again whenever your directory structure changes.

---

**`/investigate-module`** — before Claude answers, make it read first

You ask Claude about a module. It gives you a detailed explanation. Sounds right. But half of it is wrong — Claude was filling gaps from training data instead of reading your actual code. By the time you find out, you've already built on top of the wrong assumption.

`/investigate-module` forces Claude to ground its answer before saying anything. It reads AI_INDEX to find the right domain → uses grep/LSP to locate the exact file and function → reads only the relevant lines → tells you exactly what it read so you can verify. If it can't find something, it says uncertain. It doesn't guess.

Use it whenever you're asking about a module you haven't looked at in this session.

---

**`/trace-impact`** — before you change anything, find out what breaks

You change a function. Tests pass. You ship. Then you find out three services called that function, a frontend type depended on its return shape, and a test mock was hardcoded to its old behavior. None of this was obvious. Claude didn't warn you because you didn't ask, and Claude doesn't know what it doesn't know.

`/trace-impact` maps every affected place before you touch anything. It works like a breadth-first search through your codebase:

- Start at the symbol you're changing
- Level 1: everything that directly calls it (LSP findReferences — semantic, not grep)
- Level 2: everything that calls those callers
- Cross-domain: follows AI_INDEX `Connects to` to catch paths that jump module boundaries
- Tests: finds every test that covers anything in the affected set

Why breadth-first? Because you want to see all the direct impact first, before going deeper. It's systematic — nothing slips through because you happened to trace one branch before another. Stops at API boundaries so it doesn't spiral forever.

Result: a list of what must change, what might need updating, and which tests to run — before you write a single line.

Use it before every non-trivial change.

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

## CLAUDE.md — why "be careful" doesn't work

You add a rule to CLAUDE.md: "Always verify against source code before answering." Claude ignores it two messages later. You bold it. Still ignored. You move it to the top. Better, but still inconsistent.

It's not Claude ignoring you on purpose. Anthropic wraps your CLAUDE.md with: *"this context may or may not be relevant."* Under context pressure, markdown headings get deprioritized. Your rules are there — they're just losing the competition.

XML tags survive context pressure better than any markdown formatting. Use those instead:

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

Also: Claude has roughly 150–200 instruction slots total. The system prompt uses ~50. Every bullet in your CLAUDE.md is one slot. When it fills up, all rules degrade simultaneously — not just the ones at the bottom. Keep it under 200 lines.

And if you catch yourself writing "NEVER do X" in CLAUDE.md — move it to `settings.json` deny. CLAUDE.md can be overridden under pressure. `settings.json` deny cannot:

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

## Autonomy — the one rule

Claude asks "should I proceed?" before editing a file. Before running a test. Before grep. You spend half your time confirming things that obviously don't need confirming.

But if you say "just do everything without asking," Claude will also push to remote and delete files without asking.

The only rule that actually works: **judge by reversibility, not by action type.**

Editing files, running tests, grep, git add, git commit on a feature branch — all reversible, never ask. Push to remote, publish packages, deleting files, force operations, sending messages externally — irreversible or visible to others, always ask.

On a feature branch, everything up to and including commit is reversible. Push is the line.

---

## Context management

A session starts sharp. An hour in, Claude starts making mistakes it wouldn't have made at the start — forgetting earlier constraints, giving vaguer answers. The context window is filling up, and performance degrades as it fills.

- **`/clear` between unrelated tasks** — the previous task's file reads and reasoning pollute the next one
- **`/compact focus on X`** — compact with a hint so the relevant parts survive, not everything equally
- **Write state to `PLAN.md`** — progress survives a `/clear`; conversation history doesn't
- **One major task per session** — each fresh start is full performance

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

# AI Index

> A floor plan and wiring map for coding agents.

[繁體中文](README.zh-TW.md)

## In Plain English

When AI misses on a real repo, it is usually not because it is too dumb to read code.

It is because you are forcing it into a bad tradeoff.

## The Dilemma

Here is the dilemma almost every Claude Code user runs into:

### Option A: Let Claude read everything

It greps the whole repo, opens 20 files, reads thousands of lines, and tries to be thorough.

That sounds safe, but on a real repo it gets expensive fast:

- token burn goes through the roof
- context gets noisy
- the model starts forgetting what it read five minutes ago

### Option B: Let Claude read what it thinks is relevant

Now it moves faster.

It opens 3 or 4 files, gives you a confident answer, and starts coding.

That sounds efficient, but this is how you get the dangerous kind of bug:

- it fixes one obvious path
- it misses the second path it never knew existed
- you only find out later that the change was incomplete

Both options are bad.

- read too much and you waste time and tokens
- read too little and you miss things

The third option is to give Claude a map.

Think of your codebase like Tokyo's subway system.

Without a map, you can still get somewhere, but you spend the whole time wandering between lines and hoping you guessed the right transfer.

With a map, you glance once, see the route, and move.

The map does not stop exploration.

It just stops dumb exploration.

That is what `AI Index` is for.

It is not the building manual.
It is not the tourist guide.
It is the maintenance map.

## The Problem This Repo Solves

AI can already read source code.

What it still struggles with on medium and large repos is navigation:

- where to start
- which files belong to the same change surface
- which repo rules do not show up in imports
- what else needs to move before the edit is actually complete

Without a navigation layer, the agent often does something that looks correct locally but is incomplete globally.

That is why a lot of AI-generated fixes feel like "half the job."

## What AI Index Actually Is

AI Index is an AI-maintained repository graph.

Its job is simple:

- tell the agent which domain to open first
- show the main change surfaces inside that domain
- record the non-obvious "also check this" rules
- point back to real files, not prose summaries

The code is still the source of truth.

The index is just the map that helps the agent reach the right code faster and more completely.

## The Fastest Way To Understand The Difference

Think about these three tools:

### 1. Raw Code Search

Raw search is like walking around a building with a flashlight.

You can absolutely find the right room.
But you may open five wrong doors first, and you may still miss the valve room in the basement.

Raw search is great for:

- local truth
- symbol lookup
- reading exact implementation

Raw search is weak at:

- knowing which layers move together
- knowing where the blast radius really ends
- catching repo-specific coupling

### 2. Traditional Docs / Knowledge Graph

Traditional docs are like a guidebook or onboarding handbook.

They tell you:

- what the building is for
- how the different floors are supposed to work
- what a human should understand before going deeper

That is useful for:

- onboarding
- architecture explanation
- human communication

But it is usually not the best tool for "change this code without missing anything related."

### 3. AI Index

AI Index is the operations map.

It tells the agent:

- start from this area
- these routes, services, models, jobs, configs, and tests belong together
- if you touch this, also inspect these other surfaces
- here are the actual files that matter

That is why it is much better for:

- bug fixes
- feature work
- impact analysis
- reviews
- avoiding partial edits

## Tree Vs Graph

This is the real structural difference.

### Documentation Tree

Typical shape:

```text
index
  -> feature doc
    -> deeper doc
      -> code pointers
```

That is a reading path.

It answers:

- "What is this feature?"
- "What should a human read next?"

### AI Index Graph

Typical shape:

```text
AI_INDEX.md
  -> domain file
    -> change surfaces
    -> must_check rules
    -> critical nodes
    -> direct code paths
```

That is an action path.

It answers:

- "Where do I start?"
- "What else breaks with this?"
- "What should I inspect before I claim the change is done?"

If the old knowledge graph is a guidebook, AI Index is the train map plus the maintenance panel.

## What Lives Inside An AI Index

The default layout is:

```text
AI_INDEX.md
AI_INDEX/
  domain-a.md
  domain-b.md
  domain-c.md
```

`AI_INDEX.md` is the front desk map:

- read order
- repo-wide rules
- domain index

Each domain file is the local maintenance sheet:

- what this domain owns
- what the important change surfaces are
- what else must be checked
- which nodes are worth following

This is deliberately much smaller than a full documentation system.

It keeps only the things code search does not tell you fast enough.

## The Workflow

There are four parts.

### 1. Use

If the repo already has an AI Index:

- read `AI_INDEX.md`
- open only the relevant domains
- inspect the listed change surfaces
- follow `must_check`
- then read real code and edit

### 2. Generate

If the repo has no AI Index yet:

- inspect the repo
- find the real domains
- map the main change surfaces
- keep only high-value nodes
- avoid human-style prose

The goal is not "document everything."

The goal is "make future edits harder to miss."

### 3. Sync

After meaningful code changes:

- look at changed files
- map them back to affected domains
- update those domain files
- update root rules only if the change is repo-wide

### 4. Validate

Before trusting the graph:

- make sure file paths still exist
- make sure links still resolve
- make sure domain boundaries still make sense

## Why AI, Not A Script, Builds It

A script is good at extracting syntax.

It is bad at judgment.

For example, a script is not very good at deciding:

- where one domain really ends and another begins
- which coupling matters in practice
- which rules are invisible from imports
- which nodes are important enough to keep

That is why this repo moved away from "generate everything with a script."

For AI Index, the expensive part is not parsing files.

It is deciding what is actually worth remembering.

## Benchmarks

The public benchmark write-up is here:

https://dev.to/ithiria894/the-bottleneck-for-ai-coding-assistants-isnt-intelligence-its-navigation-2p30

These tests were not trying to prove that a graph always wins every tiny task.

They were testing a more practical question:

`Does the agent find the whole change surface with less wandering?`

### Headline Results

- Median token savings versus the no-map baseline: about `21%`
- Average tool-call reduction versus the no-map baseline: about `34%`
- Biggest gains showed up when a task crossed routes, services, schemas, configs, jobs, tests, or multiple repos

### Representative Results

| Scenario | Graph | No map / other flow | What changed |
|---|---:|---:|---|
| Bug fix, small repo | `14K` tokens / `10` tool calls | `14K` / `12` | same token cost, fewer steps, better cascade awareness |
| New feature planning, small repo | `11K` / `10` | `14K` / `14` | less wandering, cleaner impact sweep |
| Missing feature flag, large repo | `48K` / `14` | `72K` / `26` | graph got the agent into the right area much faster |
| Cross-repo investigation, large repo | `55K` / `18` | `82K` / `33` | graph found the wiring gap, not just the obvious endpoint |

### What The Numbers Mean

AI Index is not magic.

If the task is tiny, local, and the right file is obvious, jumping straight into code can still be cheaper.

But once the task becomes:

- "change this without missing related edits"
- "trace the real blast radius"
- "figure out which layers move together"

the graph starts to pay for itself.

## Why We Say AI Index Covers About 95% Of What Teams Actually Used Knowledge Graphs For

This is a workflow claim, not a literary claim.

In everyday engineering work, the useful questions are usually:

- where do I start
- what else is tied to this
- which files move together
- what will I miss if I only follow imports
- what tests, jobs, configs, or migrations should I inspect

That is exactly what AI Index is built to answer.

For those day-to-day coding workflows, it can usually replace about `95%` of the value teams were actually getting from a traditional knowledge graph.

The remaining `5%` is mostly:

- onboarding narrative
- architecture storytelling
- historical design rationale
- communication material for humans

Those still matter sometimes.

They are just not the highest-leverage artifact for an agent that is trying to make a correct change.

## When To Use AI Index

AI Index is most useful when:

- the repo is medium or large
- tasks often cross layers
- AI keeps missing related edits
- repo conventions matter as much as imports
- you care about blast-radius analysis

It is especially useful for:

- bug fixes with side effects
- feature work that touches multiple layers
- code review
- cross-repo tracing
- schema, config, migration, or job changes

## When Traditional Documentation Still Helps

Traditional docs are still worth it when:

- a new engineer needs the story first
- the system has heavy business context not visible in code
- you need architecture explanation for humans
- the repo is tiny and easy to sweep directly

The point is not "docs are useless."

The point is:

For AI-assisted coding, docs are often the wrong primary artifact.

## Pros

- faster orientation
- fewer wasted tool calls
- better impact analysis
- fewer partial edits
- less duplication than prose-heavy docs
- lower maintenance cost than a full knowledge graph

## Cons

- still needs maintenance
- can drift if sync is skipped
- cannot replace reading source
- weaker than human docs for onboarding narrative
- can be overkill for very small repos
- bad domain boundaries make the graph noisy

## What This Repo Provides

This repo packages the methodology in a Claude Code-friendly form:

- [`docs/AI_INDEX_SPEC.md`](docs/AI_INDEX_SPEC.md)
- [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md)
- [`skills/ai-index/SKILL.md`](skills/ai-index/SKILL.md)
- [`skills/use-ai-index/SKILL.md`](skills/use-ai-index/SKILL.md)
- [`skills/generate-graph/SKILL.md`](skills/generate-graph/SKILL.md)
- [`skills/sync-graph/SKILL.md`](skills/sync-graph/SKILL.md)

## Quick Start

Install as a Claude Code plugin:

```bash
/plugin add-marketplace https://github.com/ithiria894/AI-Index
/plugin install codebase-navigator
```

Then start with:

```text
/ai-index
```

Common modes:

- `/use-ai-index` when the repo already has an index
- `/generate-graph` when starting from zero
- `/sync-graph` after meaningful code changes

## Bottom Line

If your problem is:

`The AI does not understand what this feature is`

then write docs.

If your problem is:

`The AI changed one file and forgot the other five`

then build an AI Index.

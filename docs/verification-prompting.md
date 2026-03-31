# Verification-First Prompting

The most effective way to prevent hallucination in Claude Code is not to tell Claude "be careful" or "don't hallucinate." Those instructions are too vague to change behavior.

The effective approach: **give Claude a concrete verification mechanism**. Force grounding by requiring Claude to name its sources.

---

## The phrases that actually work

### For research and code analysis tasks

Add these to your prompt or subagent instructions:

```
Do not answer from memory.
Verify against source code.
For every important claim, name the file and function you read.
If uncertain, say "uncertain" instead of guessing.
```

The key phrase is **"name the file and function you read."** It forces Claude to either read the source (and then be accurate) or admit it hasn't (and say uncertain). It eliminates the middle ground of confident fabrication.

### For code change tasks

```
Write a failing test first if possible.
Then implement the fix.
Run the relevant tests and report the real results.
Do not claim success without verification.
```

The key constraint is **"do not claim success without verification."** Without it, Claude will often say "done" after making changes without running tests.

---

## Why "be careful" doesn't work

Telling Claude to "be careful" or "don't hallucinate" doesn't give it a mechanism. Claude already wants to be accurate — the problem is it doesn't always know the difference between a confident memory and a verified fact.

Requiring source citations forces that distinction at the output level:
- If Claude can name the file and line, it read it
- If it can't, it either says uncertain or reveals that it's reasoning from memory

---

## The CLAUDE.md version

For this to apply to every session automatically, put it in CLAUDE.md using XML tags:

```xml
<investigate_before_answering>
Never speculate about code you have not opened.
Check AI_INDEX.md first — navigation only, not source of truth.
grep/glob to locate the exact file and function before reading.
Read only the relevant section — use line ranges, not whole files.
Name what you read: "Based on src/foo.py:bar()..."
If uncertain: say "uncertain" — do not guess.
Read each file once. No redundant reads.
</investigate_before_answering>
```

XML tags are more resistant to context pressure than markdown headings. See [CLAUDE.md template](../CLAUDE.md) for the full rationale.

---

## The subagent version

When delegating investigation to a subagent:

```
Use a subagent to investigate [module/feature].
Do not answer from memory or AI_INDEX alone.
Read the actual source files before making any claim.
For every important finding, name the exact file and function.
Return: files read, functions read, uncertain parts.
Do not implement yet.
```

The "return: files read" requirement creates accountability. If the subagent can't list what it read, its findings are suspect.

---

## Escalation: what to do when uncertain is the answer

Saying "uncertain" is the correct output when Claude hasn't read the relevant source. It's not a failure — it's accurate.

The correct follow-up when Claude says uncertain:

1. Use `/investigate-module` to read the relevant module with minimum token cost
2. Or use `/trace-impact` if the uncertainty is about what a change affects
3. Or ask Claude to grep for the specific symbol and read just that section

"Uncertain" is a signal to go read, not a dead end.

---

## Sources

- Anthropic official guidance: "Give Claude a way to verify its work" as highest-leverage anti-hallucination technique
- Verification-first prompting pattern: derived from test-driven development principles applied to LLM output
- XML tag priority: centminmod/my-claude-code-setup (2138 stars), validated against markdown heading behavior under context pressure

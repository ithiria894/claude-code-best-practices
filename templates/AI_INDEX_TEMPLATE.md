# AI_INDEX.md

## How to use this file

- **Navigation only.** This file tells you where to look — not what the answer is.
- Do not treat any description here as source of truth.
- Before making any claim, read the actual source files.
- Prefer grep/glob/LSP search before opening large files.

---

## Main domains

### [Domain name — e.g. Rule evaluation]

- **Purpose:** [One line: what does this domain do?]
- **Entry:** `src/[path]/[file].py`
- **Search terms:** `FunctionName`, `ClassName`, `CONSTANT_NAME`
- **Tests:** `tests/[path]/test_[file].py`
- **Connects to:**
  - [Adjacent domain] — via `InterfaceName.method()` in `src/[path]/[file].py`
  - [API layer] — via `POST /api/[endpoint]` in `src/api/[routes].py`

---

### [Domain name — e.g. Content type handling]

- **Purpose:** [One line]
- **Entry:** `src/[path]/[file].py`
- **Search terms:** `keyword_one`, `keyword_two`
- **Tests:** `tests/[path]/test_[file].py`
- **Connects to:**
  - [Domain] — via [interface]

---

## Investigation rules

- Read only the files needed for the current task.
- If uncertain about something not in this index, say "uncertain" and grep for it.
- Do not infer behavior from this index alone.
- This file should stay under 250 lines. If it grows beyond that, split into domain-specific files.

---

## Keep this file healthy

**Good entry (pointer only):**
```
- Entry: src/auth/middleware.py
- Search: verify_token, AuthError
```

**Bad entry (summary — delete this kind):**
```
The auth middleware works by first extracting the JWT from the Authorization header,
then verifying the signature using the public key stored in...
```

If you find yourself writing explanations, stop. Write a file path instead.

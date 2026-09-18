---
description: Senior code review of current uncommitted changes (or a named file)
argument-hint: [optional file or focus]
---

Run the `code-reviewer` subagent on the current git diff. Extra focus: $ARGUMENTS

If the diff touches `server.ts` routes, auth, or user accounts, ALSO run the `security-auditor` subagent scoped to the changed routes, in parallel.

Give me one merged verdict with Must fix / Should fix / Nits, and a suggested commit message. Do not edit anything unless I say "fix it".

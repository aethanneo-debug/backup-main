---
description: Root-cause and fix a bug from a description, error message, or stack trace
argument-hint: <what's broken / paste the error>
---

Bug report: $ARGUMENTS

Delegate to the `debugger` subagent with the full bug report. If the report is missing something essential (which screen, which role, exact error), ask me ONE question first.

After the fix, run the `code-reviewer` subagent on the diff. Then give me: root cause, fix (file:line), how it was verified, and a short "why this happened" note.

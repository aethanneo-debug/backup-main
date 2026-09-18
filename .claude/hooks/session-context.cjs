#!/usr/bin/env node
// SessionStart: give Claude a quick snapshot of repo state (stdout is added to context).
const { spawnSync } = require("child_process");
const run = (a) => { const r = spawnSync("git", a, { encoding: "utf8" }); return (r.stdout || "").trim(); };
const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
const status = run(["status", "--short"]).split("\n").filter(Boolean);
const last = run(["log", "-3", "--pretty=format:%h %s (%cr)"]);
const lines = [
  `[session context] branch: ${branch || "n/a"}`,
  `uncommitted files: ${status.length}${status.length ? "\n" + status.slice(0, 15).join("\n") : ""}`,
  last ? `recent commits:\n${last}` : "",
  "Reminder: read .claude/context/known-issues.md before security- or data-related work.",
];
process.stdout.write(lines.filter(Boolean).join("\n") + "\n");

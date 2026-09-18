#!/usr/bin/env node
// PreToolUse guard: blocks dangerous commands and edits to protected files.
// Exit code 2 = block the tool call; stderr is shown to Claude as the reason.
const path = require("path");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

  const block = (msg) => { process.stderr.write(`BLOCKED by .claude/hooks/guard.cjs: ${msg}\n`); process.exit(2); };

  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const fp = ti.file_path || ti.notebook_path || "";
    const rel = path.relative(projectDir, path.resolve(projectDir, fp)).replace(/\\/g, "/");
    const base = path.basename(rel);

    if (/^\.env(\..*)?$/.test(base) && base !== ".env.example")
      block(`Editing ${rel} is not allowed. Tell the user which variable to set instead.`);
    if (/^data_store(\..*)?\.json$/.test(base) && process.env.ALLOW_DATA_EDIT !== "1")
      block(`${rel} is the live JSON database/fixture. Change data via getInitialData()/migration logic in server.ts, or ask the user for explicit permission.`);
    if (!rel.includes("/") && /^(patch|fix|rewrite|update|add)[-_].*\.(c?js|py)$|^fix\d*\.(c?js|py)$/i.test(base))
      block(`Creating root-level patch/fix scripts is forbidden in this project. Edit the source files directly.`);
    if (rel.startsWith("node_modules/") || rel.startsWith("dist/"))
      block(`Do not edit generated/vendor files (${rel}).`);
  }

  if (tool === "Bash") {
    const cmd = String(ti.command || "");
    const rules = [
      [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.|\*|src\b|backend_fastapi\b|database\b)(\s|$)/i, "Recursive delete of a project/root directory."],
      [/\bgit\s+push\b.*(--force|-f\b)/i, "Force push."],
      [/\bgit\s+reset\s+--hard\b/i, "git reset --hard discards work. Ask the user first."],
      [/\bgit\s+clean\s+-[a-z]*f/i, "git clean -f deletes untracked files. Ask the user first."],
      [/\b(DROP|TRUNCATE)\s+(DATABASE|TABLE|SCHEMA)\b/i, "Destructive SQL."],
      [/\b(rm|del|Remove-Item)\b[^|&;]*data_store[^|&;]*\.json/i, "Deleting the JSON database."],
      [/(>|\bcp\b|\bmv\b)[^|&;]*data_store(\.backup)?\.json/i, "Overwriting the JSON database."],
      [/\b(cat|type|Get-Content|more|less|head|tail)\b[^|&;]*\.env(\s|$|\.local|\.production)/i, "Reading .env secrets."],
    ];
    for (const [re, why] of rules) if (re.test(cmd)) block(`${why} Command: ${cmd}`);
  }

  process.exit(0);
});

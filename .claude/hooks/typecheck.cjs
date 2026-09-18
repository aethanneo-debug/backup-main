#!/usr/bin/env node
// PostToolUse: after editing a .ts/.tsx file, run tsc --noEmit and report errors IN THAT FILE ONLY.
// Exit 2 feeds the errors back to Claude so it fixes them immediately. Pre-existing errors elsewhere are ignored.
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }
  const fp = (input.tool_input || {}).file_path || "";
  if (!/\.(ts|tsx)$/.test(fp)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const rel = path.relative(projectDir, path.resolve(projectDir, fp)).replace(/\\/g, "/");
  if (rel.startsWith("backend_fastapi/") || rel.startsWith("node_modules/")) process.exit(0);

  const tsc = path.join(projectDir, "node_modules", "typescript", "bin", "tsc");
  if (!fs.existsSync(tsc)) process.exit(0); // deps not installed yet

  const r = spawnSync(process.execPath, [tsc, "--noEmit", "--pretty", "false"], { cwd: projectDir, encoding: "utf8", timeout: 90000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const mine = out.split(/\r?\n/).filter((l) => l.replace(/\\/g, "/").startsWith(rel + "("));
  if (mine.length) {
    process.stderr.write(`TypeScript errors in ${rel} after your edit (fix them before continuing):\n${mine.slice(0, 20).join("\n")}\n`);
    process.exit(2);
  }
  process.exit(0);
});

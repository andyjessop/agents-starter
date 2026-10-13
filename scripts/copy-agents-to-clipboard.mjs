#!/usr/bin/env node
/**
 * Concatenate every file under .agents (path header + contents) and copy to the system clipboard.
 * Usage: node scripts/copy-agents-to-clipboard.mjs [--notify]
 */
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const agentsDir = join(repoRoot, ".agents");
const notify = process.argv.includes("--notify");

async function collectFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function hasNullByte(buffer, maxScan = 8192) {
  const end = Math.min(buffer.length, maxScan);
  for (let i = 0; i < end; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

async function buildBundle() {
  const files = (await collectFiles(agentsDir)).sort();
  const chunks = [];
  let binarySkipped = 0;

  for (const absolutePath of files) {
    const rel = relative(repoRoot, absolutePath);
    const data = await readFile(absolutePath);
    chunks.push(`\n===== ${rel} =====\n`);
    if (hasNullByte(data)) {
      binarySkipped++;
      chunks.push(`[skipped: ${data.length} bytes, appears binary]\n`);
    } else {
      chunks.push(data.toString("utf8"));
      if (!data.toString("utf8").endsWith("\n")) {
        chunks.push("\n");
      }
    }
  }

  return { files, text: chunks.join(""), binarySkipped };
}

function copyToClipboard(text) {
  const result = spawnSync("pbcopy", [], { input: text, encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pbcopy exited with code ${result.status ?? "unknown"}`);
  }
}

function macNotify(title, message) {
  spawnSync("osascript", [
    "-e",
    `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
  ]);
}

async function main() {
  const { files, text, binarySkipped } = await buildBundle();
  copyToClipboard(text);

  const summary = `Copied .agents: ${files.length} files, ${text.length.toLocaleString()} characters${binarySkipped ? ` (${binarySkipped} binary skipped)` : ""}.`;
  console.log(summary);

  if (notify) {
    macNotify("agent-starter", summary);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(clientRoot, "src");
const modulesRoot = path.join(srcRoot, "modules");

const forbiddenPatterns = [
  { pattern: /\bcreateAsyncThunk\b/, label: "createAsyncThunk" },
  { pattern: /\bcreateListenerMiddleware\b/, label: "createListenerMiddleware" },
  { pattern: /\bstartListening\b/, label: "startListening" },
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isUnderModules(filePath) {
  const relative = path.relative(modulesRoot, filePath);
  return relative.length > 0 && !relative.startsWith("..");
}

const violations = [];
for (const filePath of await walk(srcRoot)) {
  if (isUnderModules(filePath)) {
    continue;
  }
  const source = await readFile(filePath, "utf8");
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(source)) {
      violations.push(
        `${path.relative(clientRoot, filePath)}: ${label} belongs in a module Redux file (see apps/client/.agents/rules/modules.md).`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Modular effects check failed:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Matches style props that assign CSS custom properties in TSX. */
const inlineCustomProperty =
  /style=\{\{[\s\S]*?["']?--[A-Za-z0-9_-]+["']?\s*:/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

const violations = [];
for await (const filePath of walk(root)) {
  const source = await readFile(filePath, "utf8");
  for (const match of source.matchAll(inlineCustomProperty)) {
    const line = source.slice(0, match.index).split("\n").length;
    violations.push(`${path.relative(root, filePath)}:${line}`);
  }
}

if (violations.length > 0) {
  console.error(
    "Inline style must not set CSS custom properties. Use a class in @layer app instead.",
  );
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

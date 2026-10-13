import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const internalInString =
  /(?:LIVE_[A-Z0-9_]+|REQUEST_FAILED|(?<![a-z])unauthenticated(?![a-z]))/;

const testAssertionOnNavigationMessage =
  /navigation\.message[^;\n]*(?:LIVE_|REQUEST_FAILED)/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && /\.(tsx?)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

const violations = [];
for await (const filePath of walk(srcRoot)) {
  const relative = path.relative(srcRoot, filePath);
  const isTest =
    relative.endsWith(".test.ts") || relative.endsWith(".store.test.ts");
  const source = await readFile(filePath, "utf8");

  if (isTest) {
    if (testAssertionOnNavigationMessage.test(source)) {
      violations.push(
        `${relative}: store tests must assert qualitative navigation copy, not internal LIVE_* or REQUEST_FAILED labels (errors.md).`,
      );
    }
    continue;
  }

  if (!relative.endsWith(".tsx")) {
    continue;
  }

  for (const match of source.matchAll(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g)) {
    const literal = match[0];
    if (internalInString.test(literal)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(
        `${relative}:${line}: internal label in React copy; map through appFailure / userFacingDetail instead (src/user-facing-error.ts).`,
      );
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("Internal UI label check failed:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

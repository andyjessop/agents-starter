import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulesRoot = path.join(clientRoot, "src", "modules");

const forbiddenName = /-(redux|react)\.(ts|tsx)$/;

async function listModuleDirs() {
  const entries = await readdir(modulesRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function moduleUsesRedux(modulePath) {
  try {
    await stat(path.join(modulePath, "redux.ts"));
    return true;
  } catch {
    // no root redux.ts
  }
  try {
    const reduxDir = path.join(modulePath, "redux");
    const info = await stat(reduxDir);
    return info.isDirectory();
  } catch {
    return false;
  }
}

const violations = [];

for (const moduleName of await listModuleDirs()) {
  const modulePath = path.join(modulesRoot, moduleName);
  const files = await walkFiles(modulePath);

  for (const filePath of files) {
    const base = path.basename(filePath);
    if (forbiddenName.test(base)) {
      violations.push(
        `${path.relative(clientRoot, filePath)}: do not encode the layer in the filename; use redux/ or react/ (see apps/client/.agents/rules/modules.md).`,
      );
    }
  }

  const hasRootRedux = files.some(
    (filePath) => path.basename(filePath) === "redux.ts" && path.dirname(filePath) === modulePath,
  );
  const hasReduxDir = files.some((filePath) =>
    path.relative(modulePath, filePath).startsWith(`redux${path.sep}`),
  );
  if (hasRootRedux && hasReduxDir) {
    violations.push(
      `src/modules/${moduleName}: use either redux.ts (one slice) or redux/ (several slices), not both.`,
    );
  }

  if (!(await moduleUsesRedux(modulePath))) {
    continue;
  }

  const rootTsx = files.filter(
    (filePath) =>
      filePath.endsWith(".tsx") &&
      path.dirname(filePath) === modulePath &&
      path.basename(filePath) !== "react.tsx",
  );
  for (const filePath of rootTsx) {
    violations.push(
      `${path.relative(clientRoot, filePath)}: move presentation under react/ or merge into react.tsx (see modules.md).`,
    );
  }
}

if (violations.length > 0) {
  console.error("Module layout check failed:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

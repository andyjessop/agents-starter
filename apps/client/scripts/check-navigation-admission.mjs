import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const admissionSource = path.join(clientRoot, "src/modules/navigation/admit.ts");

/** Route admission must use catalogue live scopes, not detail-only sockets (navigation-admission.md). */
const detailOnlyLiveSelect =
  /endpoints\.live(?:Nodelet|Operation|Receipt)\.select|endpoints\.liveDemoItem\.select/;

const source = await readFile(admissionSource, "utf8");
const violations = [];
if (detailOnlyLiveSelect.test(source)) {
  violations.push(
    `${path.relative(clientRoot, admissionSource)}: route admission must not wait on detail-only live endpoints; use catalogue scopes such as liveDemoCatalogue (see apps/client/.agents/rules/navigation-admission.md).`,
  );
}

if (violations.length > 0) {
  console.error("Navigation admission check failed:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

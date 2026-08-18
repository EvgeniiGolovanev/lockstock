import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_RUNTIME_FILES = new Set([
  "stock-management-overview-context.svg", "stock-management-overview-context-fr.svg",
  "stock-movement-workflow.svg", "stock-movement-workflow-fr.svg",
  "purchase-order-lifecycle.svg", "purchase-order-lifecycle-fr.svg",
  "member-group-workflow.svg", "member-group-workflow-fr.svg"
]);

function relativeFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry))
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)))
    .sort();
}

function copyManagedTree(source, target, sourcePredicate = () => true, targetPredicate = sourcePredicate) {
  const sourceFiles = relativeFiles(source, sourcePredicate);
  const targetFiles = relativeFiles(target, targetPredicate);
  const sourceSet = new Set(sourceFiles);
  const unexpectedFiles = targetFiles.filter((relative) => !sourceSet.has(relative));
  if (unexpectedFiles.length > 0) {
    throw new Error(`Refusing to remove unmanaged files from ${path.relative(ROOT, target)}: ${unexpectedFiles.join(", ")}`);
  }

  for (const relative of sourceFiles) {
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, relative), destination);
  }
}

function main() {
  const canonicalSkills = path.join(ROOT, ".agents", "skills");
  for (const directory of [".agent", ".claude", ".cline"]) {
    copyManagedTree(canonicalSkills, path.join(ROOT, directory, "skills"));
  }
  copyManagedTree(
    path.join(ROOT, "design", "workflows"),
    path.join(ROOT, "public", "workflows"),
    (entry) => WORKFLOW_RUNTIME_FILES.has(entry.name),
    (entry) => entry.name.endsWith(".svg")
  );
  console.log("Synchronized compatibility skills and runtime workflow SVGs.");
}

main();

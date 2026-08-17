import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractLocalMarkdownLinks, formatBytes, summarizeAssets } from "./repository-hygiene-core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_SKILLS = path.join(ROOT, ".agents", "skills");
const COMPATIBILITY_SKILLS = [".agent", ".claude", ".cline"].map((directory) => path.join(ROOT, directory, "skills"));
const WORKFLOW_SOURCE = path.join(ROOT, "design", "workflows");
const WORKFLOW_RUNTIME = path.join(ROOT, "public", "workflows");
const WORKFLOW_RUNTIME_FILES = new Set([
  "stock-management-overview-context.svg",
  "stock-management-overview-context-fr.svg",
  "stock-movement-workflow.svg",
  "stock-movement-workflow-fr.svg",
  "purchase-order-lifecycle.svg",
  "purchase-order-lifecycle-fr.svg",
  "member-group-workflow.svg",
  "member-group-workflow-fr.svg"
]);
const DEMO_CAPTURE_DIRECTORIES = [
  path.join(ROOT, "design", "demo-captures"),
  path.join(ROOT, "design", "demo-captures-fr")
];
const DEMO_RUNTIME_FILES = ["lockstock-demo.mp4", "lockstock-demo-fr.mp4"];

function fail(message) {
  throw new Error(message);
}

function relativeFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) fail(`Missing required directory: ${path.relative(ROOT, directory)}`);
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry))
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, "/"))
    .sort();
}

function sameContents(left, right) {
  return fs.readFileSync(left).equals(fs.readFileSync(right));
}

function assertMirrors(source, targets, label, sourcePredicate, targetPredicate = sourcePredicate) {
  const sourceFiles = relativeFiles(source, sourcePredicate);
  for (const target of targets) {
    const targetFiles = relativeFiles(target, targetPredicate);
    if (sourceFiles.join("\n") !== targetFiles.join("\n")) {
      fail(`${label} manifest differs: ${path.relative(ROOT, target)}`);
    }
    for (const relativeFile of sourceFiles) {
      if (!sameContents(path.join(source, relativeFile), path.join(target, relativeFile))) {
        fail(`${label} content differs: ${path.relative(ROOT, target, relativeFile)}`);
      }
    }
  }
}

function collectPublicAssets() {
  const publicDir = path.join(ROOT, "public");
  return relativeFiles(publicDir).map((relativeFile) => {
    const absolutePath = path.join(publicDir, relativeFile);
    return { path: `public/${relativeFile}`, bytes: fs.statSync(absolutePath).size };
  });
}

function assertDemoMedia() {
  for (const directory of DEMO_CAPTURE_DIRECTORIES) {
    if (relativeFiles(directory).length === 0) {
      fail(`Demo capture source is empty: ${path.relative(ROOT, directory)}`);
    }
  }
  for (const filename of DEMO_RUNTIME_FILES) {
    const runtimeAsset = path.join(ROOT, "public", filename);
    if (!fs.existsSync(runtimeAsset)) fail(`Missing runtime demo asset: public/${filename}`);
    const sourceReference = fs.readFileSync(path.join(ROOT, "lib", "ui", "demo-video.ts"), "utf8");
    if (!sourceReference.includes(`/${filename}`)) fail(`Runtime demo asset is not referenced: public/${filename}`);
  }
}

function trackedMarkdownFiles() {
  return execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((relative) => path.join(ROOT, relative));
}

function headingAnchors(markdown) {
  return new Set(
    [...markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((match) => match[1]
      .toLowerCase()
      .replace(/[`*_~]/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-"))
  );
}

function assertMarkdownLinks() {
  for (const markdownPath of trackedMarkdownFiles()) {
    for (const target of extractLocalMarkdownLinks(fs.readFileSync(markdownPath, "utf8"))) {
      const [targetPath, fragment] = target.split("#", 2);
      if (targetPath.startsWith("__missing_reference__/")) {
        fail(`Broken documentation reference: ${path.relative(ROOT, markdownPath)} -> ${target}`);
      }
      const destination = targetPath ? path.resolve(path.dirname(markdownPath), targetPath) : markdownPath;
      if (!fs.existsSync(destination)) {
        fail(`Broken documentation link: ${path.relative(ROOT, markdownPath)} -> ${target}`);
      }
      if (fragment && !headingAnchors(fs.readFileSync(destination, "utf8")).has(decodeURIComponent(fragment).toLowerCase())) {
        fail(`Broken documentation anchor: ${path.relative(ROOT, markdownPath)} -> ${target}`);
      }
    }
  }
}

function main() {
  assertMirrors(CANONICAL_SKILLS, COMPATIBILITY_SKILLS, "Compatibility skill tree");
  assertMirrors(
    WORKFLOW_SOURCE,
    [WORKFLOW_RUNTIME],
    "Workflow runtime copy",
    (entry) => WORKFLOW_RUNTIME_FILES.has(entry.name),
    (entry) => entry.name.endsWith(".svg")
  );
  assertDemoMedia();
  assertMarkdownLinks();

  const report = summarizeAssets(collectPublicAssets());
  console.log(`Public assets: ${report.fileCount} files, ${formatBytes(report.totalBytes)}`);
  console.log("Largest public assets:");
  for (const asset of report.largest) console.log(`- ${asset.path}: ${formatBytes(asset.bytes)}`);
  console.log("Repository hygiene checks passed.");
}

main();

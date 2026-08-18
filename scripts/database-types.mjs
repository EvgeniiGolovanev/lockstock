import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compareDatabaseTypes, normalizeDatabaseTypes } from "./database-types-core.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseTypesPath = path.join(repositoryRoot, "types", "database.ts");

function runSupabase(args) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const error = new Error(`supabase ${args.join(" ")} failed with exit code ${result.status}.`);
    error.output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw error;
  }
  return result.stdout;
}

function refreshLocalDatabase() {
  runSupabase(["db", "reset", "--local", "--workdir", repositoryRoot, "--yes"]);
}

function generateTypes() {
  return normalizeDatabaseTypes(
    runSupabase(["gen", "types", "--local", "--lang=typescript", "--schema", "public"])
  );
}

function writeTypes() {
  refreshLocalDatabase();
  const generated = generateTypes();
  writeFileSync(databaseTypesPath, generated, "utf8");
  console.log(`Updated ${path.relative(repositoryRoot, databaseTypesPath)}`);
}

function checkTypes() {
  refreshLocalDatabase();
  const generated = generateTypes();
  const current = readFileSync(databaseTypesPath, "utf8");
  const comparison = compareDatabaseTypes(current, generated);

  if (!comparison.matches) {
    throw new Error(
      `${path.relative(repositoryRoot, databaseTypesPath)} is out of date. Run npm run db:types to refresh the generated contract.`
    );
  }

  console.log("types/database.ts is in sync with the local Supabase schema.");
}

const mode = process.argv[2] ?? "write";

if (mode === "check") {
  checkTypes();
} else if (mode === "write") {
  writeTypes();
} else {
  throw new Error(`Unknown database types mode: ${mode}`);
}

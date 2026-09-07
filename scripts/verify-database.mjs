import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { rewriteSupabaseConfig, startWithPortRetry } = require("./verify-database-core.js");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSupabaseDirectory = path.join(repositoryRoot, "supabase");
// Webpack cannot make relative entry paths across Windows drive letters when
// the disposable application links to the repository's node_modules.
const disposableParent = process.argv.includes("--inventory") && process.platform === "win32"
  ? path.dirname(repositoryRoot)
  : tmpdir();
const disposableRoot = mkdtempSync(path.join(disposableParent, "lockstock-db-verification-"));
const disposableSupabaseDirectory = path.join(disposableRoot, "supabase");
const projectId = `lockstock-db-verification-${process.pid}`;
const migrationUnderTest = "202608131200_enforce_database_authorization_entitlements.sql";
const excludedServices = [
  "realtime",
  "storage-api",
  "imgproxy",
  "mailpit",
  "postgres-meta",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "supavisor"
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a disposable database port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function runSupabase(args, { capture = false } = {}) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(executable, args, {
    cwd: disposableRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });

  if (result.stdout && !capture) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr && !capture) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const commandError = new Error(`supabase ${args.join(" ")} failed with exit code ${result.status}.`);
    commandError.output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw commandError;
  }
  return result.stdout;
}

function runDatabaseSql(statement) {
  const executable = process.platform === "win32" ? "docker.exe" : "docker";
  const result = spawnSync(
    executable,
    ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    {
      encoding: "utf8",
      input: `\\set VERBOSITY verbose\n${statement}`,
      maxBuffer: 16 * 1024 * 1024
    }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Disposable database SQL failed with exit code ${result.status}.`);
}

let stackStarted = false;

try {
  cpSync(sourceSupabaseDirectory, disposableSupabaseDirectory, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes(".temp")
  });

  // Start from the historical baseline, apply the new migration inside an
  // explicit transaction, and prove ROLLBACK leaves no new schema object.
  // Then restore the file and let db reset apply it normally for the suite.
  const disposableMigrationPath = path.join(disposableSupabaseDirectory, "migrations", migrationUnderTest);
  const stagedMigrationPath = path.join(disposableRoot, migrationUnderTest);
  renameSync(disposableMigrationPath, stagedMigrationPath);

  const configPath = path.join(disposableSupabaseDirectory, "config.toml");
  const originalConfig = readFileSync(configPath, "utf8");
  let apiPort;
  const startResult = await startWithPortRetry({
    allocatePort: async () => {
      const databasePort = await getFreePort();
      apiPort = await getFreePort();
      return databasePort;
    },
    cleanupFailedStart: () =>
      runSupabase(["stop", "--project-id", projectId, "--no-backup", "--workdir", disposableRoot]),
    configure: (databasePort) => {
      const disposableConfig = rewriteSupabaseConfig(originalConfig, { apiPort, databasePort, projectId });
      writeFileSync(configPath, disposableConfig, "utf8");
      console.log(`Starting disposable Supabase project ${projectId} on database port ${databasePort}.`);
    },
    maxAttempts: 3,
    start: () =>
      runSupabase([
        "start",
        "--workdir",
        disposableRoot,
        "--exclude",
        excludedServices.join(",")
      ], { capture: true })
  });
  stackStarted = true;
  if (startResult.attempts > 1) {
    console.log(
      `Started disposable Supabase after ${startResult.attempts} attempts on database port ${startResult.databasePort}.`
    );
  }
  const migrationSql = readFileSync(stagedMigrationPath, "utf8");
  runDatabaseSql(`begin;\n${migrationSql}\nrollback;`);
  runDatabaseSql(`
    do $$ begin
      if to_regprocedure('public.workspace_has_write_access(uuid)') is not null then
        raise exception 'workspace_has_write_access survived rollback';
      end if;
      if exists (
        select 1 from pg_trigger where tgname in ('trg_workspace_write_guard', 'trg_workspace_actor')
      ) then
        raise exception 'P0-01 guard trigger survived rollback';
      end if;
    end $$;
  `);
  console.log("Transactional migration rollback proof passed.");
  renameSync(stagedMigrationPath, disposableMigrationPath);
  runSupabase(["db", "reset", "--local", "--workdir", disposableRoot]);
  runSupabase([
    "test",
    "db",
    "supabase/tests",
    "--local",
    "--workdir",
    disposableRoot
  ]);
  const statusJson = runSupabase(
    ["status", "--output", "json", "--workdir", disposableRoot],
    { capture: true }
  );
  const apiVerification = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, "scripts", "verify-database-api.mjs"), projectId, statusJson],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 16 * 1024 * 1024
    }
  );
  if (apiVerification.stdout) process.stdout.write(apiVerification.stdout);
  if (apiVerification.stderr) process.stderr.write(apiVerification.stderr);
  if (apiVerification.error) throw apiVerification.error;
  if (apiVerification.status !== 0) {
    throw new Error(`Data API database verification failed with exit code ${apiVerification.status}.`);
  }
  if (process.argv.includes("--inventory")) {
    // Copy application sources without local environment files or build output.
    // Next may rewrite next-env.d.ts/tsconfig; keep those changes isolated too.
    const applicationRoot = path.join(disposableRoot, "application");
    for (const entry of ["app", "components", "lib", "public", "types", "styles", "next.config.mjs", "next-env.d.ts", "package.json", "tsconfig.json", "middleware.ts", "proxy.ts", "postcss.config.mjs"]) {
      const source = path.join(repositoryRoot, entry);
      if (existsSync(source)) cpSync(source, path.join(applicationRoot, entry), { recursive: true });
    }
    symlinkSync(path.join(repositoryRoot, "node_modules"), path.join(applicationRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const status = JSON.parse(statusJson);
    console.log("Running inventory acceptance tests against the disposable application and database.");
    const inventoryVerification = spawnSync(process.execPath, [
      path.join(repositoryRoot, "node_modules", "@playwright", "test", "cli.js"),
      "test", "--config", "playwright.inventory.config.ts", ...process.argv.slice(2).filter((arg) => arg !== "--inventory")
    ], {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        INVENTORY_APP_ROOT: applicationRoot,
        INVENTORY_APP_PORT: String(await getFreePort()),
        INVENTORY_DISPOSABLE_PROJECT: projectId,
        INVENTORY_SUPABASE_URL: status.API_URL,
        INVENTORY_ANON_KEY: status.ANON_KEY,
        INVENTORY_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY
      }
    });
    if (inventoryVerification.error) throw inventoryVerification.error;
    if (inventoryVerification.status !== 0) throw new Error(`Inventory acceptance tests failed with exit code ${inventoryVerification.status}.`);
  }
} finally {
  let cleanupFailure;
  if (stackStarted) {
    try {
      runSupabase(["stop", "--project-id", projectId, "--no-backup", "--workdir", disposableRoot]);
    } catch (cleanupError) {
      console.error(`Failed to clean up disposable Supabase project: ${cleanupError.message}`);
      cleanupFailure = cleanupError;
    }
  }
  rmSync(disposableRoot, { recursive: true, force: true });
  if (cleanupFailure) {
    throw cleanupFailure;
  }
}

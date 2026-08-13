import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const disposableRoot = mkdtempSync(path.join(tmpdir(), "lockstock-db-verification-"));
const disposableSupabaseDirectory = path.join(disposableRoot, "supabase");
const projectId = `lockstock-db-verification-${process.pid}`;
const excludedServices = [
  "gotrue",
  "realtime",
  "storage-api",
  "imgproxy",
  "kong",
  "mailpit",
  "postgrest",
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

function runSupabase(args) {
  const executable = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(executable, args, {
    cwd: disposableRoot,
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
    const commandError = new Error(`supabase ${args.join(" ")} failed with exit code ${result.status}.`);
    commandError.output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw commandError;
  }
}

let stackStarted = false;

try {
  cpSync(sourceSupabaseDirectory, disposableSupabaseDirectory, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes(".temp")
  });

  const configPath = path.join(disposableSupabaseDirectory, "config.toml");
  const originalConfig = readFileSync(configPath, "utf8");
  const startResult = await startWithPortRetry({
    allocatePort: getFreePort,
    cleanupFailedStart: () =>
      runSupabase(["stop", "--project-id", projectId, "--no-backup", "--workdir", disposableRoot]),
    configure: (databasePort) => {
      const disposableConfig = rewriteSupabaseConfig(originalConfig, { databasePort, projectId });
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
      ])
  });
  stackStarted = true;
  if (startResult.attempts > 1) {
    console.log(
      `Started disposable Supabase after ${startResult.attempts} attempts on database port ${startResult.databasePort}.`
    );
  }
  runSupabase(["db", "reset", "--local", "--workdir", disposableRoot]);
  runSupabase([
    "test",
    "db",
    "supabase/tests/authorization.test.sql",
    "--local",
    "--workdir",
    disposableRoot
  ]);
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

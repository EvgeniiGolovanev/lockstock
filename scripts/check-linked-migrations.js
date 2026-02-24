const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MIGRATION_FILENAME = /^(\d+)_.*\.sql$/;
const VERSION_TOKEN = /^\d{10,}$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getLocalMigrationVersions() {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fail(`Missing migrations directory: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .map((file) => {
      const match = file.match(MIGRATION_FILENAME);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort();
}

function getRemoteMigrationVersions() {
  const run = spawnSync("supabase", ["migration", "list", "--linked"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

  if (run.error) {
    fail(`Failed to execute Supabase CLI: ${run.error.message}`);
  }

  if (run.status !== 0) {
    const details = [run.stdout, run.stderr].filter(Boolean).join("\n").trim();
    fail(`Failed to read linked migration status.\n${details}`);
  }

  const output = [run.stdout, run.stderr].filter(Boolean).join("\n");
  const remote = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.includes("|")) {
      continue;
    }

    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 2) {
      continue;
    }

    const remoteVersion = parts[1];
    if (VERSION_TOKEN.test(remoteVersion)) {
      remote.add(remoteVersion);
    }
  }

  if (remote.size === 0) {
    fail(
      "Could not parse remote migration versions from `supabase migration list --linked` output.",
    );
  }

  return remote;
}

const localVersions = getLocalMigrationVersions();
const remoteVersions = getRemoteMigrationVersions();

if (localVersions.length === 0) {
  fail("No local migrations found in `supabase/migrations`.");
}

const missing = localVersions.filter((version) => !remoteVersions.has(version));

if (missing.length > 0) {
  fail(
    `Linked database is behind local schema migrations. Missing versions: ${missing.join(", ")}`,
  );
}

console.log("Linked database is up to date with local migrations.");

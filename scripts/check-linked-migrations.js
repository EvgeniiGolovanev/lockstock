const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MIGRATION_FILENAME = /^(\d+)_.*\.sql$/;
const VERSION_TOKEN = /^\d{10,}$/;
const VERSION_TOKEN_GLOBAL = /\b\d{10,}\b/g;

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
  const runJson = spawnSync(
    "supabase",
    ["migration", "list", "--linked", "--output", "json"],
    {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    },
  );

  if (runJson.error) {
    fail(`Failed to execute Supabase CLI: ${runJson.error.message}`);
  }

  if (runJson.status === 0) {
    const output = [runJson.stdout, runJson.stderr].filter(Boolean).join("\n");
    const remoteFromJson = parseRemoteMigrationVersionsFromJsonOutput(output);
    if (remoteFromJson.size > 0) {
      return remoteFromJson;
    }
  }

  const runPretty = spawnSync("supabase", ["migration", "list", "--linked"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

  if (runPretty.error) {
    fail(`Failed to execute Supabase CLI: ${runPretty.error.message}`);
  }

  if (runPretty.status !== 0) {
    const details = [runPretty.stdout, runPretty.stderr].filter(Boolean).join("\n").trim();
    fail(`Failed to read linked migration status.\n${details}`);
  }

  const output = [runPretty.stdout, runPretty.stderr].filter(Boolean).join("\n");
  const remote = parseRemoteMigrationVersionsFromPrettyOutput(output);

  if (remote.size === 0) {
    const details = output.trim();
    fail(
      `Could not parse remote migration versions from \`supabase migration list --linked\` output.\n${details}`,
    );
  }

  return remote;
}

function collectVersionTokens(raw) {
  if (raw == null) {
    return [];
  }

  const text = String(raw);
  const matches = text.match(VERSION_TOKEN_GLOBAL);
  return matches ? matches.filter((match) => VERSION_TOKEN.test(match)) : [];
}

function collectRemoteVersionsFromJsonValue(value, remote, inRemoteContext = false) {
  if (value == null) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    if (inRemoteContext) {
      for (const version of collectVersionTokens(value)) {
        remote.add(version);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRemoteVersionsFromJsonValue(item, remote, inRemoteContext);
    }
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    const hasRemoteKey = entries.some(([key]) => /remote/i.test(key));
    const hasVersionKey = entries.some(([key]) => /version/i.test(key));
    const hasLocalKey = entries.some(([key]) => /local/i.test(key));

    // Some CLI JSON formats return only remote rows with "version" keys.
    // In that case we can safely treat version fields as remote context.
    const assumeRemoteContext = inRemoteContext || hasRemoteKey || (hasVersionKey && !hasLocalKey);

    for (const [key, nestedValue] of entries) {
      const nextRemoteContext = inRemoteContext || /remote/i.test(key);
      collectRemoteVersionsFromJsonValue(
        nestedValue,
        remote,
        nextRemoteContext || (assumeRemoteContext && /version/i.test(key)),
      );
    }
  }
}

function parseRemoteMigrationVersionsFromJsonOutput(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return new Set();
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return new Set();
  }

  const remote = new Set();
  collectRemoteVersionsFromJsonValue(parsed, remote);
  return remote;
}

function parseRemoteMigrationVersionsFromPrettyOutput(output) {
  const remote = new Set();
  let remoteColumnIndex = 1;
  let headerColumns = null;
  let sawTableRow = false;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.replace(/[\u2502\u2503]/g, "|").trim();
    let parts = [];

    if (line.includes("|")) {
      sawTableRow = true;
      parts = line.split("|").map((part) => part.trim());
    } else {
      // Fallback for pretty output variants that use spacing instead of pipe characters.
      parts = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        sawTableRow = true;
      } else {
        continue;
      }
    }

    if (parts.length < 2) {
      continue;
    }

    const joined = parts.join(" ").toLowerCase();
    if (joined.includes("remote")) {
      const candidateIndex = parts.findIndex((part) => /remote/i.test(part));
      if (candidateIndex >= 0) {
        remoteColumnIndex = candidateIndex;
      }
      headerColumns = parts.map((part) => part.toLowerCase());
      continue;
    }

    if (/^-+$/.test(parts.join("").replace(/\s/g, ""))) {
      continue;
    }

    // If we saw a header row, align remote column by name when possible.
    if (headerColumns && headerColumns.length === parts.length) {
      const idx = headerColumns.findIndex((part) => part.includes("remote"));
      if (idx >= 0) {
        remoteColumnIndex = idx;
      }
    }

    const remoteCell = parts[remoteColumnIndex] ?? parts[1] ?? "";
    for (const version of collectVersionTokens(remoteCell)) {
      remote.add(version);
    }
  }

  if (remote.size === 0 && !sawTableRow) {
    for (const rawLine of output.split(/\r?\n/)) {
      if (/remote/i.test(rawLine)) {
        for (const version of collectVersionTokens(rawLine)) {
          remote.add(version);
        }
      }
    }
  }

  return remote;
}

function main() {
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
}

if (require.main === module) {
  main();
}

module.exports = {
  collectVersionTokens,
  parseRemoteMigrationVersionsFromJsonOutput,
  parseRemoteMigrationVersionsFromPrettyOutput,
};

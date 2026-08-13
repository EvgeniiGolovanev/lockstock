const PORT_CONFLICT_PATTERN =
  /(?:address already in use|bind for .+ failed|only one usage of each socket address|port is already (?:allocated|in use)|ports? (?:are|is) not available)/i;

function readProjectId(config) {
  const match = /^project_id\s*=\s*"([^"]+)"\s*$/m.exec(config);
  return match?.[1] ?? null;
}

function findDatabasePort(config) {
  const databaseHeader = /^\[db\]\s*$/m.exec(config);
  if (!databaseHeader) {
    return null;
  }

  const sectionStart = databaseHeader.index + databaseHeader[0].length;
  const remainingConfig = config.slice(sectionStart);
  const nextSection = /^\[[^\]\r\n]+\]\s*$/m.exec(remainingConfig);
  const sectionEnd = nextSection ? sectionStart + nextSection.index : config.length;
  const section = config.slice(sectionStart, sectionEnd);
  const portMatch = /^port\s*=\s*(\d+)\s*$/m.exec(section);

  if (!portMatch) {
    return null;
  }

  return {
    end: sectionStart + portMatch.index + portMatch[0].length,
    start: sectionStart + portMatch.index,
    value: Number(portMatch[1])
  };
}

function rewriteSupabaseConfig(originalConfig, { projectId, databasePort }) {
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new Error("Expected a non-empty disposable Supabase project_id.");
  }
  if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
    throw new Error("Expected [db].port to be an integer between 1 and 65535.");
  }

  const originalProjectId = readProjectId(originalConfig);
  if (originalProjectId === null) {
    throw new Error("Could not find project_id in the Supabase configuration.");
  }

  const originalDatabasePort = findDatabasePort(originalConfig);
  if (originalDatabasePort === null) {
    throw new Error("Could not find [db].port in the Supabase configuration.");
  }

  const projectRewritten = originalConfig.replace(
    /^project_id\s*=\s*"[^"]+"\s*$/m,
    `project_id = "${projectId}"`
  );
  const databasePortLocation = findDatabasePort(projectRewritten);
  if (databasePortLocation === null) {
    throw new Error("Could not find [db].port after replacing project_id.");
  }
  const rewrittenConfig =
    projectRewritten.slice(0, databasePortLocation.start) +
    `port = ${databasePort}` +
    projectRewritten.slice(databasePortLocation.end);

  if (readProjectId(rewrittenConfig) !== projectId) {
    throw new Error(`Failed to replace project_id with the expected value: ${projectId}.`);
  }

  const rewrittenDatabasePort = findDatabasePort(rewrittenConfig);
  if (rewrittenDatabasePort?.value !== databasePort) {
    throw new Error(`Failed to replace [db].port with the expected value: ${databasePort}.`);
  }

  return rewrittenConfig;
}

function isPortConflictError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const output = typeof error.output === "string" ? error.output : "";
  return PORT_CONFLICT_PATTERN.test(`${error.message}\n${output}`);
}

async function startWithPortRetry({
  allocatePort,
  cleanupFailedStart,
  configure,
  maxAttempts = 3,
  start
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const databasePort = await allocatePort();
    await configure(databasePort);

    try {
      await start(databasePort);
      return { attempts: attempt, databasePort };
    } catch (startError) {
      try {
        await cleanupFailedStart(databasePort);
      } catch (cleanupError) {
        throw new AggregateError(
          [startError, cleanupError],
          `Supabase start failed on port ${databasePort}, and cleanup also failed.`
        );
      }

      if (!isPortConflictError(startError) || attempt === maxAttempts) {
        throw startError;
      }
    }
  }

  throw new Error("Supabase start retry loop ended unexpectedly.");
}

module.exports = {
  isPortConflictError,
  rewriteSupabaseConfig,
  startWithPortRetry
};

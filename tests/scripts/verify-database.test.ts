import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

type RetryOptions = {
  maxAttempts?: number;
  allocatePort: () => number | Promise<number>;
  configure: (databasePort: number) => void | Promise<void>;
  start: (databasePort: number) => void | Promise<void>;
  cleanupFailedStart: (databasePort: number) => void | Promise<void>;
};

const requireFromTest = createRequire(import.meta.url);
const { isPortConflictError, rewriteSupabaseConfig, startWithPortRetry } = requireFromTest(
  "../../scripts/verify-database-core.js"
) as {
  isPortConflictError: (error: unknown) => boolean;
  rewriteSupabaseConfig: (
    originalConfig: string,
    expected: { projectId: string; databasePort: number }
  ) => string;
  startWithPortRetry: (options: RetryOptions) => Promise<{ attempts: number; databasePort: number }>;
};

const BASE_CONFIG = `project_id = "lockstock"

[api]
port = 55321

[db]
port = 55322
shadow_port = 55320

[studio]
port = 55323
`;

describe("disposable database verifier", () => {
  describe("rewriteSupabaseConfig", () => {
    it("replaces and independently verifies the project ID and database port", () => {
      const rewritten = rewriteSupabaseConfig(BASE_CONFIG, {
        projectId: "lockstock-db-verification-123",
        databasePort: 61234
      });

      expect(rewritten).toContain('project_id = "lockstock-db-verification-123"');
      expect(rewritten).toMatch(/\[db\]\s+port = 61234/);
      expect(rewritten).toContain("shadow_port = 55320");
      expect(rewritten).toContain("[api]\nport = 55321");
    });

    it("fails when project_id is absent even when the database port can be replaced", () => {
      const configWithoutProjectId = BASE_CONFIG.replace('project_id = "lockstock"\n\n', "");

      expect(() =>
        rewriteSupabaseConfig(configWithoutProjectId, {
          projectId: "lockstock-db-verification-123",
          databasePort: 61234
        })
      ).toThrow(/project_id/);
    });

    it("fails when [db].port is absent even when the project ID can be replaced", () => {
      const configWithoutDatabasePort = BASE_CONFIG.replace("[db]\nport = 55322\n", "[db]\n");

      expect(() =>
        rewriteSupabaseConfig(configWithoutDatabasePort, {
          projectId: "lockstock-db-verification-123",
          databasePort: 61234
        })
      ).toThrow(/\[db\]\.port/);
    });
  });

  describe("startWithPortRetry", () => {
    it("cleans a failed bind attempt, allocates a new port, and retries within the limit", async () => {
      const allocatePort = vi.fn().mockResolvedValueOnce(61001).mockResolvedValueOnce(61002);
      const configure = vi.fn();
      const bindConflict = Object.assign(new Error("supabase start failed"), {
        output: "Bind for 0.0.0.0:61001 failed: port is already allocated"
      });
      const start = vi.fn().mockRejectedValueOnce(bindConflict).mockResolvedValueOnce(undefined);
      const cleanupFailedStart = vi.fn();

      await expect(
        startWithPortRetry({ allocatePort, configure, start, cleanupFailedStart, maxAttempts: 3 })
      ).resolves.toEqual({ attempts: 2, databasePort: 61002 });

      expect(configure).toHaveBeenNthCalledWith(1, 61001);
      expect(configure).toHaveBeenNthCalledWith(2, 61002);
      expect(start).toHaveBeenCalledTimes(2);
      expect(cleanupFailedStart).toHaveBeenCalledExactlyOnceWith(61001);
      expect(cleanupFailedStart.mock.invocationCallOrder[0]).toBeLessThan(configure.mock.invocationCallOrder[1]);
    });

    it("cleans and rethrows a non-port start error without retrying", async () => {
      const allocatePort = vi.fn().mockResolvedValue(61001);
      const configure = vi.fn();
      const migrationError = Object.assign(new Error("supabase start failed"), {
        output: "Applying migration failed: relation already exists"
      });
      const start = vi.fn().mockRejectedValue(migrationError);
      const cleanupFailedStart = vi.fn();

      await expect(
        startWithPortRetry({ allocatePort, configure, start, cleanupFailedStart, maxAttempts: 3 })
      ).rejects.toBe(migrationError);

      expect(allocatePort).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
      expect(cleanupFailedStart).toHaveBeenCalledExactlyOnceWith(61001);
      expect(isPortConflictError(migrationError)).toBe(false);
    });

    it("stops after the configured number of port-conflict attempts", async () => {
      const allocatePort = vi
        .fn()
        .mockResolvedValueOnce(61001)
        .mockResolvedValueOnce(61002)
        .mockResolvedValueOnce(61003);
      const configure = vi.fn();
      const bindConflict = Object.assign(new Error("supabase start failed"), {
        output: "listen tcp 0.0.0.0:61001: bind: address already in use"
      });
      const start = vi.fn().mockRejectedValue(bindConflict);
      const cleanupFailedStart = vi.fn();

      await expect(
        startWithPortRetry({ allocatePort, configure, start, cleanupFailedStart, maxAttempts: 3 })
      ).rejects.toBe(bindConflict);

      expect(allocatePort).toHaveBeenCalledTimes(3);
      expect(start).toHaveBeenCalledTimes(3);
      expect(cleanupFailedStart).toHaveBeenCalledTimes(3);
      expect(isPortConflictError(bindConflict)).toBe(true);
    });
  });
});

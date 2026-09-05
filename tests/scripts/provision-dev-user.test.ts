import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const { provisionDevUser } = requireFromTest("../../scripts/provision-dev-user-core.js") as {
  provisionDevUser: (options: {
    config: { email: string; password: string; url: string; company: string };
    listUsers: () => Promise<Array<{ id: string; email?: string | null }>>;
    createUser: (input: { email: string; password: string; emailConfirm: boolean }) => Promise<{ id: string; email?: string | null }>;
    authenticate: (input: { email: string; password: string }) => Promise<void>;
    listMemberships: (userId: string) => Promise<Array<{ orgId: string }>>;
    createWorkspace: (user: { id: string; email?: string | null }) => Promise<{ orgId: string }>;
  }) => Promise<{ userId: string; createdUser: boolean; createdWorkspace: boolean; orgId: string | null }>;
};

describe("local development user provisioner", () => {
  it("creates a confirmed local user and starter workspace when neither exists", async () => {
    const createUser = vi.fn().mockResolvedValue({ id: "user-123", email: "alex@example.test" });
    const authenticate = vi.fn().mockResolvedValue(undefined);
    const createWorkspace = vi.fn().mockResolvedValue({ orgId: "org-123" });

    await expect(
      provisionDevUser({
        config: {
          email: "alex@example.test",
          password: "local-only-password",
          url: "http://127.0.0.1:55321",
          company: "Alex Test Workspace"
        },
        listUsers: vi.fn().mockResolvedValue([]),
        createUser,
        authenticate,
        listMemberships: vi.fn().mockResolvedValue([]),
        createWorkspace
      })
    ).resolves.toEqual({
      userId: "user-123",
      createdUser: true,
      createdWorkspace: true,
      orgId: "org-123"
    });

    expect(createUser).toHaveBeenCalledExactlyOnceWith({
      email: "alex@example.test",
      password: "local-only-password",
      emailConfirm: true
    });
    expect(authenticate).toHaveBeenCalledExactlyOnceWith({ email: "alex@example.test", password: "local-only-password" });
    expect(createWorkspace).toHaveBeenCalledExactlyOnceWith({ id: "user-123", email: "alex@example.test" });
  });

  it("keeps an existing user and workspace unchanged", async () => {
    const createUser = vi.fn();
    const createWorkspace = vi.fn();
    const authenticate = vi.fn().mockResolvedValue(undefined);

    await expect(
      provisionDevUser({
        config: {
          email: "alex@example.test",
          password: "local-only-password",
          url: "http://localhost:55321",
          company: "Alex Test Workspace"
        },
        listUsers: vi.fn().mockResolvedValue([{ id: "user-123", email: "Alex@Example.Test" }]),
        createUser,
        authenticate,
        listMemberships: vi.fn().mockResolvedValue([{ orgId: "org-123" }]),
        createWorkspace
      })
    ).resolves.toEqual({
      userId: "user-123",
      createdUser: false,
      createdWorkspace: false,
      orgId: "org-123"
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(authenticate).toHaveBeenCalledExactlyOnceWith({ email: "alex@example.test", password: "local-only-password" });
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  it("rejects a non-local Supabase URL before it can use an admin key", async () => {
    const listUsers = vi.fn();

    await expect(
      provisionDevUser({
        config: {
          email: "alex@example.test",
          password: "local-only-password",
          url: "https://project.supabase.co",
          company: "Alex Test Workspace"
        },
        listUsers,
        createUser: vi.fn(),
        authenticate: vi.fn(),
        listMemberships: vi.fn(),
        createWorkspace: vi.fn()
      })
    ).rejects.toThrow(/local Supabase URL/i);

    expect(listUsers).not.toHaveBeenCalled();
  });
});

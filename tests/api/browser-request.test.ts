import { afterEach, describe, expect, it, vi } from "vitest";
import { browserApiRequest } from "@/lib/api/browser-request";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browserApiRequest", () => {
  it("attaches the current session token and active org id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const result = await browserApiRequest<{ data: { ok: boolean } }>("/api/organizations", {
      baseUrl: "https://app.example",
      orgId: "11111111-1111-4111-8111-111111111111",
      fetchImpl,
      getSession: async () => ({ access_token: "session-token" })
    });

    expect(result.data.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://app.example/api/organizations",
      expect.objectContaining({
        method: "GET",
        signal: undefined
      })
    );

    const [, init] = vi.mocked(fetchImpl).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-org-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(headers.get("x-request-id")).toMatch(/^req_/);
  });

  it("throws a safe 401 error when there is no active session", async () => {
    await expect(
      browserApiRequest("/api/organizations", {
        baseUrl: "https://app.example",
        fetchImpl: vi.fn(),
        getSession: async () => null
      })
    ).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
      message: "Sign in to continue."
    });
  });

  it("normalizes 400, 402, 403, and 500 responses to stable public errors", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Validation failed.", code: "validation_failed" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Payment required.", code: "payment_required" }), {
          status: 402,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Forbidden.", code: "forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response("database: relation \"suppliers\" does not exist", {
          status: 500,
          headers: { "content-type": "text/plain" }
        })
      );

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ status: 400, code: "validation_failed", message: "Validation failed." });

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ status: 402, code: "payment_required", message: "This workspace requires an active plan." });

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ status: 403, code: "forbidden", message: "You do not have permission to perform this action." });

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ status: 500, code: "internal_error", message: "Unexpected server error." });
  });

  it("reports aborts, network failures, non-json responses, and cross-origin production requests safely", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const abortingFetch = vi.fn().mockRejectedValue(abortError);
    const networkFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const nonJsonFetch = vi.fn().mockResolvedValue(new Response("plain text", { status: 200 }));

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl: abortingFetch,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ code: "request_cancelled", status: 499 });

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl: networkFetch,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ code: "network_error", status: 0, message: "fetch failed" });

    await expect(
      browserApiRequest("/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl: nonJsonFetch,
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ code: "request_invalid", status: 500, message: "Unexpected response format." });

    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", { location: { origin: "https://app.example" } });

    await expect(
      browserApiRequest("https://other.example/api/materials", {
        baseUrl: "https://app.example",
        fetchImpl: vi.fn(),
        getSession: async () => ({ access_token: "session-token" })
      })
    ).rejects.toMatchObject({ code: "invalid_origin", status: 400 });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

describe("production error instrumentation", () => {
  afterEach(() => {
    delete process.env.OBSERVABILITY_ENDPOINT;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("handles an unknown error type and a digest without sending raw details", async () => {
    process.env.OBSERVABILITY_ENDPOINT = "https://monitoring.example/errors";
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", send);
    await onRequestError({ digest: "safe-digest" } as unknown as Error, { path: "", method: "GET", headers: {} }, { routerKind: "App Router", routePath: "/", routeType: "render", renderSource: "server-rendering", revalidateReason: undefined });
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject({ error: { type: "UnknownError", digest: "safe-digest" }, request: { path: "/" } });
  });

  it.each([new Error("receiver unreachable"), "receiver unreachable"])("contains a reporting transport failure", async failure => {
    process.env.OBSERVABILITY_ENDPOINT = "https://monitoring.example/errors";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(onRequestError(new Error("boom"), { path: "/api/contact", method: "POST", headers: {} }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined })).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith("Observability error reporting failed", { message: "receiver unreachable" });
  });

  it("does nothing until an observability endpoint is configured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await onRequestError(new Error("boom"), { path: "/api/contact", method: "POST", headers: { cookie: "secret" } }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("records rejected alert delivery without logging response contents", async () => {
    process.env.OBSERVABILITY_ENDPOINT = "https://monitoring.example/errors";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider response", { status: 401 })));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await onRequestError(new Error("boom"), { path: "/api/contact", method: "POST", headers: {} }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined });
      expect(logged).toHaveBeenCalledWith("Observability error reporting failed", { message: "Observability endpoint returned HTTP 401." });
      expect(JSON.stringify(logged.mock.calls)).not.toContain("private provider response");
    } finally {
      logged.mockRestore();
    }
  });

  it("reports a scrubbed error with a correlation ID and no request secrets", async () => {
    process.env.OBSERVABILITY_ENDPOINT = "https://monitoring.example/errors";
    const fetch = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetch);

    await onRequestError(new Error("database password=secret@example.com"), { path: "/api/contact?email=secret@example.com", method: "POST", headers: { cookie: "secret" } }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined });

    expect(fetch).toHaveBeenCalledWith("https://monitoring.example/errors", expect.objectContaining({ method: "POST" }));
    const body = String(fetch.mock.calls[0][1].body);
    expect(body).toContain('"correlationId":"obs_');
    expect(body).toContain('"path":"/api/contact"');
    expect(body).not.toContain("secret");
    expect(body).not.toContain("password=");
  });
});

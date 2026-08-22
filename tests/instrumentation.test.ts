import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

describe("production error instrumentation", () => {
  afterEach(() => {
    delete process.env.OBSERVABILITY_ENDPOINT;
    vi.unstubAllGlobals();
  });

  it("does nothing until an observability endpoint is configured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await onRequestError(new Error("boom"), { path: "/api/contact", method: "POST", headers: { cookie: "secret" } }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined });

    expect(fetch).not.toHaveBeenCalled();
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

// @vitest-environment node
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

afterEach(() => { delete process.env.OBSERVABILITY_ENDPOINT; vi.restoreAllMocks(); });

it("delivers a scrubbed alert to a real local HTTP receiver", async () => {
  let payload = "";
  const server = createServer();
  const received = new Promise<void>(resolve => {
    server.on("request", (request, response) => {
      request.on("data", chunk => { payload += chunk; });
      request.on("end", () => { response.writeHead(204).end(); resolve(); });
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local receiver did not start.");
  process.env.OBSERVABILITY_ENDPOINT = `http://127.0.0.1:${address.port}/errors`;
  try {
    await onRequestError(new Error("password=private@example.test"), { path: "/api/contact?email=private@example.test", method: "POST", headers: { cookie: "private-cookie" } }, { routerKind: "App Router", routePath: "/app/api/contact/route", routeType: "route", renderSource: "server-rendering", revalidateReason: undefined });
    await received;
    expect(JSON.parse(payload)).toMatchObject({ request: { path: "/api/contact", method: "POST" }, error: { type: "Error" } });
    expect(payload).toContain('"correlationId":"obs_');
    expect(payload).not.toMatch(/private|password|cookie/);
  } finally {
    server.close();
    await once(server, "close");
  }
});

import { test, expect } from "./fixtures";

test("a real unhandled Next.js route failure delivers a scrubbed alert to the local receiver", async ({ request, inventory }) => {
  const result = await request.get("/api/acceptance-error?email=synthetic-private@example.test", { headers: { ...inventory.headers(), cookie: "synthetic-private-cookie" } });
  expect(result.status()).toBe(500);
  let alerts: Array<{ correlationId: string; request: { path: string; method: string } }> = [];
  await expect.poll(async () => {
    const response = await request.get(`http://127.0.0.1:${process.env.INVENTORY_ALERT_PORT}/alerts`);
    alerts = await response.json();
    return alerts.filter(alert => alert.request.path === "/api/acceptance-error").length;
  }).toBeGreaterThan(0);
  const alert = alerts.find(alert => alert.request.path === "/api/acceptance-error")!;
  expect(alert.correlationId).toMatch(/^obs_/);
  expect(alert.request.method).toBe("GET");
  expect(JSON.stringify(alert)).not.toMatch(/synthetic-private|cookie|email|\?/);
});

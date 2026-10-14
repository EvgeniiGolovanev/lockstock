import { createServer } from "node:http";

const port = Number(process.env.INVENTORY_ALERT_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Set INVENTORY_ALERT_PORT to a local test receiver port.");
const alerts = [];
const server = createServer(async (request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(alerts));
    return;
  }
  if (request.method !== "POST") { response.writeHead(405).end(); return; }
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) { response.writeHead(413).end(); return; }
  }
  try { alerts.push(JSON.parse(body)); response.writeHead(204).end(); }
  catch { response.writeHead(400).end(); }
});
server.listen(port, "127.0.0.1");
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());

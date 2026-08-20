import type { Instrumentation } from "next";
import { createCorrelationId } from "@/lib/api/correlation-id";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const endpoint = process.env.OBSERVABILITY_ENDPOINT;
  if (!endpoint) return;

  const correlationId = createCorrelationId("obs");
  const errorType = error instanceof Error ? error.name : "UnknownError";
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  const path = request.path.split("?", 1)[0] || "/";

  console.error("Server error observed", {
    correlationId,
    errorType,
    digest,
    path,
    method: request.method,
    routePath: context.routePath
  });

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        correlationId,
        error: { type: errorType, digest },
        request: { path, method: request.method },
        context: {
          routerKind: context.routerKind,
          routePath: context.routePath,
          routeType: context.routeType
        }
      }),
      signal: AbortSignal.timeout(2_000)
    });
  } catch (reportingError) {
    console.error("Observability error reporting failed", {
      message: reportingError instanceof Error ? reportingError.message : String(reportingError)
    });
  }
};

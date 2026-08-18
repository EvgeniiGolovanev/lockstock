import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCorrelationId } from "@/lib/api/correlation-id";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type DatabaseLikeError = {
  message: string;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

function statusCodeToPublicCode(status: number) {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 402:
      return "payment_required";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_failed";
    default:
      return status >= 500 ? "internal_error" : "request_failed";
  }
}

function isDatabaseLikeError(error: unknown): error is DatabaseLikeError {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string";
}

export function handleApiError(error: unknown) {
  const requestId = createCorrelationId();

  if (error instanceof ApiError) {
    const code = statusCodeToPublicCode(error.status);
    if (error.status >= 500) {
      console.error("API error", { requestId, status: error.status, code, message: error.message, details: error.details ?? null });
    } else if (error.status === 401 || error.status === 403) {
      console.warn("API authorization failure", { requestId, status: error.status, code, message: error.message });
    }

    return NextResponse.json({ error: error.message, code, requestId }, { status: error.status, headers: { "x-request-id": requestId } });
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed.", code: "validation_failed", requestId, details: error.flatten() }, { status: 400, headers: { "x-request-id": requestId } });
  }

  if (isDatabaseLikeError(error)) {
    console.error("Database error", { requestId, code: error.code ?? null, message: error.message, details: error.details ?? null, hint: error.hint ?? null });

    return NextResponse.json({ error: "Unexpected server error.", code: "internal_error", requestId }, { status: 500, headers: { "x-request-id": requestId } });
  }

  console.error("Unexpected API error", { requestId, error });

  return NextResponse.json({ error: "Unexpected server error.", code: "internal_error", requestId }, { status: 500, headers: { "x-request-id": requestId } });
}

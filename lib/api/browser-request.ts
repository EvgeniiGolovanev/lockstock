import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { createCorrelationId } from "@/lib/api/correlation-id";

type SessionLike = {
  access_token: string;
} | null;

export type BrowserApiErrorCode =
  | "bad_request"
  | "conflict"
  | "forbidden"
  | "internal_error"
  | "invalid_origin"
  | "network_error"
  | "payment_required"
  | "not_found"
  | "request_cancelled"
  | "request_failed"
  | "request_invalid"
  | "unauthorized"
  | "validation_failed";

export class BrowserApiError extends Error {
  readonly status: number;
  readonly code: BrowserApiErrorCode;
  readonly requestId: string;

  constructor(status: number, code: BrowserApiErrorCode, message: string, requestId: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type BrowserApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: BodyInit | Record<string, unknown> | null;
  baseUrl?: string;
  orgId?: string | null;
  signal?: AbortSignal;
  headers?: HeadersInit;
  getSession?: () => Promise<SessionLike>;
  fetchImpl?: typeof fetch;
  responseType?: "json" | "text" | "blob";
};

function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function normalizeBaseUrl(baseUrl?: string) {
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  return (baseUrl || fallback).replace(/\/+$/, "");
}

function resolveRequestUrl(path: string, baseUrl?: string) {
  const url = new URL(path, normalizeBaseUrl(baseUrl));
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production" && isAbsoluteUrl(path) && url.origin !== window.location.origin) {
    throw new BrowserApiError(400, "invalid_origin", "Browser requests must stay on the current origin in production.", createCorrelationId("req"));
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV === "production" && url.origin !== window.location.origin) {
    throw new BrowserApiError(400, "invalid_origin", "Browser requests must stay on the current origin in production.", createCorrelationId("req"));
  }

  return url;
}

async function defaultGetSession(): Promise<SessionLike> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session ?? null;
}

function isJsonContentType(contentType: string | null) {
  return Boolean(contentType && contentType.toLowerCase().includes("application/json"));
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readResponseText(response: Response) {
  if (typeof response.text === "function") {
    return await response.text();
  }

  if (typeof response.json === "function") {
    const value = await response.json();
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return "";
}

function readResponseHeader(response: Response, name: string) {
  const headers = response.headers;
  if (headers && typeof headers.get === "function") {
    return headers.get(name);
  }

  return null;
}

function extractMessage(payload: Record<string, unknown> | null, fallback: string) {
  const value = payload?.error ?? payload?.message;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function extractCode(status: number, payload: Record<string, unknown> | null): BrowserApiErrorCode {
  const rawCode = payload?.code;
  if (typeof rawCode === "string" && rawCode.trim()) {
    return rawCode as BrowserApiErrorCode;
  }

  switch (status) {
    case 400:
      return "validation_failed";
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
    default:
      return status >= 500 ? "internal_error" : "request_failed";
  }
}

function extractSafeMessage(status: number, payload: Record<string, unknown> | null) {
  switch (status) {
    case 401:
      return "Sign in to continue.";
    case 402:
      return "This workspace requires an active plan.";
    case 403:
      return "You do not have permission to perform this action.";
    case 400:
      return extractMessage(payload, "Request validation failed.");
    case 404:
      return "Requested resource not found.";
    case 409:
      return extractMessage(payload, "The request could not be completed because of a conflict.");
    default:
      return status >= 500 ? "Unexpected server error." : extractMessage(payload, "Request failed.");
  }
}

export async function browserApiRequest<T>(path: string, options: BrowserApiRequestOptions = {}): Promise<T> {
  const requestId = createCorrelationId("req");
  const fetchImpl = options.fetchImpl ?? fetch;
  const getSession = options.getSession ?? defaultGetSession;
  const session = await getSession();

  if (!session?.access_token) {
    throw new BrowserApiError(401, "unauthorized", "Sign in to continue.", requestId);
  }

  const url = resolveRequestUrl(path, options.baseUrl);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("x-request-id", requestId);
  if (options.orgId) {
    headers.set("x-org-id", options.orgId);
  }

  const method = options.method ?? "GET";
  const hasBody = options.body !== undefined && options.body !== null;
  let body: BodyInit | undefined;

  if (hasBody) {
    if (typeof options.body === "string" || options.body instanceof FormData || options.body instanceof Blob || options.body instanceof URLSearchParams || options.body instanceof ReadableStream) {
      body = options.body;
    } else {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }
  }

  try {
    const response = await fetchImpl(url.toString(), { method, headers, body, signal: options.signal });

    if (!response.ok) {
      const text = await readResponseText(response);
      const payload = text ? safeParseJson(text) : null;
      const responseRequestId = readResponseHeader(response, "x-request-id") ?? requestId;
      throw new BrowserApiError(response.status, extractCode(response.status, payload), extractSafeMessage(response.status, payload), responseRequestId);
    }

    if (options.responseType === "blob") {
      return (await response.blob()) as T;
    }

    if (options.responseType === "text") {
      return (await response.text()) as T;
    }

    const text = await readResponseText(response);
    const contentType = readResponseHeader(response, "content-type");
    const payload = text ? safeParseJson(text) : null;

    if (!text.trim()) {
      return undefined as T;
    }

    if (isJsonContentType(contentType)) {
      return (payload ?? undefined) as T;
    }

    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      const parsed = safeParseJson(text);
      if (parsed) {
        return parsed as T;
      }
    }

    throw new BrowserApiError(500, "request_invalid", "Unexpected response format.", requestId);
  } catch (error) {
    if (error instanceof BrowserApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BrowserApiError(499, "request_cancelled", "Request was cancelled.", requestId);
    }

    throw new BrowserApiError(0, "network_error", error instanceof Error && error.message ? error.message : "Network request failed.", requestId);
  }
}

// Thin fetch wrapper for the /api/** rewrites. Always builds a Request so
// the RUM fetch instrumentation sees (and scrubs) the URL.

import { SpanStatusCode, trace } from "@opentelemetry/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const request = new Request(path.startsWith("http") ? path : new URL(path, location.origin), {
    ...rest,
    headers: { accept: "application/json", ...(json !== undefined ? { "content-type": "application/json" } : {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let response: Response;
  try {
    response = await fetch(request);
  } catch {
    throw new ApiError(0, "We couldn't reach Northcrest Air. Check your connection and try again.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

const tracer = trace.getTracer("northcrest-web");

/**
 * Run a user action in its own span, so its API calls hang off a named
 * parent ("search flights", "create booking") in the trace.
 */
export function traced<T>(name: string, attributes: Record<string, string | number>, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn();
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

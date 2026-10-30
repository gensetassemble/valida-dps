// Next's internal request URL can use localhost while the browser connects to
// 127.0.0.1. Host is the public HTTP authority received by this server.
export function isSameOrigin(request: Request, allowMissing = false) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return allowMissing;
  try {
    const source = new URL(origin),
      target = new URL(request.url);
    return (
      source.origin === target.origin ||
      (source.host === request.headers.get("host") &&
        source.protocol === target.protocol)
    );
  } catch {
    return false;
  }
}

import "server-only";
import { Client } from "@microsoft/microsoft-graph-client";
// An approved server-side token provider is required; never accept tokens from a request body.
export function createGraphClient(acquireApprovedToken: () => Promise<string>) {
  return Client.initWithMiddleware({
    authProvider: { getAccessToken: acquireApprovedToken },
  });
}

import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { randomUUID } from "node:crypto";
import { getMailDeliveryConfig, MAIL_TEST_RECIPIENT } from "./delivery-config";
import { emailHtml } from "@/features/operations/renewal-email";

export type DeliveryResult = { state: "accepted" | "failed" | "uncertain" | "retry"; code: string; requestId?: string; retryAfter?: number };
export type OutgoingEmail = { to: string; subject: string; body: string; id: string; test: boolean; kind: "renewal" | "reminder" };
let cachedAuth: { key: string; client: ConfidentialClientApplication } | undefined;
// Application identity: no user refresh tokens are stored. Exchange Application RBAC
// must restrict this identity to the configured sender mailbox before activation.
export async function deliverMicrosoftEmail(message: OutgoingEmail): Promise<DeliveryResult> {
  const config = getMailDeliveryConfig();
  if (!config) return { state: "failed", code: "INTEGRATION_DISABLED" };
  if (message.kind === "reminder" && process.env.ENABLE_EMAIL_REMINDERS !== "true") return { state: "failed", code: "REMINDERS_DISABLED" };
  if (message.kind === "renewal" && !message.test && process.env.ENABLE_OUTLOOK_COMMERCIAL !== "true")
    return { state: "failed", code: "COMMERCIAL_DISABLED" };
  if (config.mode === "test" && !message.test) return { state: "failed", code: "LIVE_MODE_REQUIRED" };
  const to = config.mode === "test" || message.test ? MAIL_TEST_RECIPIENT : message.to;
  const key = JSON.stringify([config.tenantId,config.clientId,config.clientSecret]);
  if (!cachedAuth || cachedAuth.key !== key) cachedAuth = { key, client: new ConfidentialClientApplication({ auth: { clientId: config.clientId,
    authority: `https://login.microsoftonline.com/${config.tenantId}`, clientSecret: config.clientSecret } }) };
  const msal = cachedAuth.client;
  let token: string;
  let tokenTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([msal.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] }),
      new Promise<never>((_,reject) => { tokenTimeout = setTimeout(() => reject(Error("Token timeout")),8000); })]);
    if (!result?.accessToken) return { state: "failed", code: "TOKEN_UNAVAILABLE" };
    token = result.accessToken;
  } catch { return { state: "failed", code: "MAILBOX_AUTHORIZATION_REQUIRED" }; }
  finally { if (tokenTimeout) clearTimeout(tokenTimeout); }
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "client-request-id": randomUUID() },
      body: JSON.stringify({ message: { subject: message.subject, body: { contentType: "HTML", content: emailHtml(message.body) },
        toRecipients: [{ emailAddress: { address: to } }], internetMessageHeaders: [{ name: "x-valida-delivery-id", value: message.id }] }, saveToSentItems: true }),
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    const requestId = response.headers.get("request-id") || undefined;
    if (response.status === 202) return { state: "accepted", code: "GRAPH_ACCEPTED", requestId };
    if (response.status === 429) return { state: "retry", code: "GRAPH_THROTTLED", requestId,
      retryAfter: Math.max(60, Math.min(86400, Number(response.headers.get("retry-after")) || 300)) };
    // 5xx / a lost response may follow acceptance. Never blindly send again.
    return { state: response.status >= 500 || response.status === 408 ? "uncertain" : "failed", code: `GRAPH_${response.status}`, requestId };
  } catch { return { state: "uncertain", code: "GRAPH_RESPONSE_UNKNOWN" }; }
}

import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { getMicrosoftConfig } from "./config";
export const DELEGATED_SCOPES = ["https://graph.microsoft.com/Mail.Send"];
// No route initiates OAuth until durable encrypted token storage and account binding are implemented.
export function createMicrosoftAuthClient() {
  const config = getMicrosoftConfig();
  if (!config) throw new Error("Konfigurasi Microsoft Entra belum lengkap.");
  return new ConfidentialClientApplication({ auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, clientSecret: config.clientSecret } });
}

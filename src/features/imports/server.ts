import "server-only";
import { requireActiveUser } from "@/lib/auth/guards";
import { activeBranch } from "@/lib/auth/permissions";
import { masterClient } from "@/features/master-data/server";
import type { ImportDomain } from "./normalize";
import { canImportDomain, importDomainsForScopes } from "./access";
export async function importContext(requested?: string, domain?: ImportDomain) {
  const c = await requireActiveUser();
  const branch = activeBranch(c.scopes, c.profile.branch_code, requested);
  const allowedDomains = importDomainsForScopes(c.scopes, branch);
  if (
    (domain && !canImportDomain(c.scopes, branch, domain)) ||
    (!domain && !allowedDomains.length)
  )
    throw Error("Impor tidak tersedia untuk peran Anda pada cabang ini.");
  return { ...c, branch, allowedDomains, db: await masterClient() };
}
export async function importPageContext(requested?: string, domain?: ImportDomain) {
  try {
    return await importContext(requested, domain);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Impor ")
    )
      return null;
    throw error;
  }
}
export async function importApiContext(requested?: string, domain?: ImportDomain) {
  try {
    return await importContext(requested, domain);
  } catch {
    return null;
  }
}

import "server-only";
import { requireActiveUser } from "@/lib/auth/guards";
import { activeBranch, hasPermission } from "@/lib/auth/permissions";
import { masterClient } from "@/features/master-data/server";
import type { ImportDomain } from "./normalize";
export async function importContext(requested?: string, domain?: ImportDomain) {
  void domain;
  const c = await requireActiveUser();
  const branch = activeBranch(c.scopes, c.profile.branch_code, requested);
  if (!hasPermission(c.scopes, branch, ["admin"]))
    throw Error("Impor hanya tersedia untuk Admin cabang.");
  return { ...c, branch, db: await masterClient() };
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

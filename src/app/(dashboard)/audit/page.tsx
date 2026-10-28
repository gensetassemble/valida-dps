import { MasterPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  return <MasterPage entity="audit" params={await searchParams} />;
}

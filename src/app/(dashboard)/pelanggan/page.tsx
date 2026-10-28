import { MasterPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  return <MasterPage entity="pelanggan" params={await searchParams} />;
}

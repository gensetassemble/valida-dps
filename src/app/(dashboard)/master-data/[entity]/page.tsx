import { notFound } from "next/navigation";
import { MASTER_KEYS } from "@/features/master-data/registry";
import { MasterPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<QueryParams>;
}) {
  const { entity } = await params;
  if (!MASTER_KEYS.includes(entity)) notFound();
  return <MasterPage entity={entity} params={await searchParams} />;
}

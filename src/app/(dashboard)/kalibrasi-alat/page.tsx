import { OperationList } from "@/features/operations/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  return <OperationList entity="kalibrasi-alat" params={await searchParams} />;
}

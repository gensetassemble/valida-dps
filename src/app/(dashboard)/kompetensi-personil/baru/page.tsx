import { OperationEditor } from "@/features/operations/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  return (
    <OperationEditor entity="kompetensi-personil" params={await searchParams} />
  );
}

import { OperationEditor } from "@/features/operations/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<QueryParams>;
}) {
  return (
    <OperationEditor
      entity="sertifikat-klien"
      id={(await params).id}
      params={await searchParams}
    />
  );
}

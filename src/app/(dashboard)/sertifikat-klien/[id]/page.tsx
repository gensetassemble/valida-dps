import { OperationDetail } from "@/features/operations/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<QueryParams>;
}) {
  return (
    <OperationDetail
      entity="sertifikat-klien"
      id={(await params).id}
      params={await searchParams}
    />
  );
}

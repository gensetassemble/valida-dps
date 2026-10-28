import { DetailPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<QueryParams>;
}) {
  return (
    <DetailPage
      entity="pelanggan"
      id={(await params).id}
      params={await searchParams}
      child="kontak"
      field="client_id"
    />
  );
}

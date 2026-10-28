import { DetailPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function UserDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<QueryParams>;
}) {
  return (
    <DetailPage
      entity="pengguna"
      id={(await params).id}
      params={await searchParams}
      child="penugasan-peran"
      field="profile_id"
    />
  );
}

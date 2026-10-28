import { notFound } from "next/navigation";
import { DetailPage } from "@/features/master-data/pages";
import type { QueryParams } from "@/features/master-data/server";
export default async function EntityDetail({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<QueryParams>;
}) {
  const { entity, id } = await params;
  const children: Record<string, { child: string; field: string }> = {
    pegawai: { child: "penugasan", field: "employee_id" },
    portofolio: { child: "alias", field: "portfolio_id" },
    "jenis-sertifikat": { child: "persyaratan", field: "certificate_type_id" },
  };
  const detail = children[entity];
  if (!detail) notFound();
  return (
    <DetailPage
      entity={entity}
      id={id}
      params={await searchParams}
      {...detail}
    />
  );
}

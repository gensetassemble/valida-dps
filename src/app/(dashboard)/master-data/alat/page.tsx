import Link from "next/link";
import { AccessDenied } from "@/components/ui/access-denied";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MasterTable } from "@/features/master-data/pages";
import {
  pageEntityContext,
  type QueryParams,
} from "@/features/master-data/server";

export default async function EquipmentDirectory({
  searchParams,
}: {
  searchParams: Promise<QueryParams>;
}) {
  const params = await searchParams;
  const context = await pageEntityContext("kalibrasi-alat", params.branch);
  if (!context) return <AccessDenied />;
  return (
    <>
      <PageHeader
        title="Direktori Alat"
        eyebrow={`Master data cabang ${context.branch}`}
        description="Identitas alat internal, portofolio, lokasi, dan koordinator penanggung jawab. Menggunakan data yang sama dengan Kalibrasi Alat."
      />
      <Card className="mb-5 space-y-2 p-4 text-xs leading-6">
        <p>
          <strong>Tambah / ubah:</strong> IT Officer, Admin, dan PTK sesuai
          portofolio tugasnya.
        </p>
        <p>
          <strong>Baca:</strong> QSHE, Koordinator Operasional, Kepala Bidang,
          Kepala UP, Kepala Cabang dan Tester sesuai cakupannya. AM, HRGA, dan
          Personil tidak mendapat akses alat dari peran tersebut.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            className="font-semibold text-primary-hover underline"
            href={`/kalibrasi-alat?branch=${context.branch}`}
          >
            Buka monitoring kalibrasi
          </Link>
          <Link
            className="font-semibold text-primary-hover underline"
            href={`/master-data?branch=${context.branch}#matriks-akses`}
          >
            Lihat matriks seluruh peran
          </Link>
        </div>
      </Card>
      <MasterTable
        entity="kalibrasi-alat"
        params={{ ...params, branch: context.branch }}
      />
    </>
  );
}

import Link from "next/link";
import { Card } from "./card";
import { PageHeader } from "./page-header";
export function AccessDenied() {
  return (
    <Card className="p-6">
      <PageHeader
        title="Akses ditolak"
        description="Peran Anda tidak memiliki kewenangan untuk data atau cabang yang diminta."
      />
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-primary-hover underline"
      >
        Kembali ke dashboard
      </Link>
    </Card>
  );
}

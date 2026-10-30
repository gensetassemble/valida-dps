import { masterClient, type DataRow } from "@/features/master-data/server";
import { Card } from "@/components/ui/card";
import { formatBusinessDate, formatTimestamp } from "@/lib/format";
import { EmployeeStatusDialog } from "./employee-status-dialog";
import { EMPLOYEE_STATUS_REASONS } from "./employee-status-model";

export async function EmployeeStatusPanel({ branch, row, own }: { branch: string; row: DataRow; own: boolean }) {
  const db = await masterClient();
  const { data, error } = await db.from("employee_status_events").select("id,new_status,reason,notes,effective_on,created_at").eq("employee_id", row.id).eq("branch_code", branch).order("created_at", { ascending: false }).limit(50);
  if (error) throw Error("Riwayat status personil belum dapat dimuat.");
  return <Card className="mb-5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold">Status kepegawaian · HRGA</h2>{!own && <EmployeeStatusDialog branch={branch} employee={String(row.id)} version={Number(row.employment_status_version)} name={String(row.full_name)} status={String(row.employment_status)}/>}</div>
    <p className="mt-2 text-xs text-muted-foreground">Perubahan status tidak menghapus sertifikat atau riwayat. Pengaktifan kembali tetap mengikuti penugasan akun yang berlaku.</p>
    {!!data?.length && <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Riwayat status personil</summary><ol className="mt-3 space-y-3">{data.map((event) => <li key={event.id} className="border-l-2 border-border pl-3"><strong>{event.new_status === "inactive" ? "Nonaktif" : "Aktif"}</strong> · {EMPLOYEE_STATUS_REASONS[event.reason as keyof typeof EMPLOYEE_STATUS_REASONS]} · efektif {formatBusinessDate(event.effective_on)}<p className="mt-1 whitespace-pre-wrap">{event.notes}</p><p className="mt-1 text-muted-foreground">Dicatat {formatTimestamp(event.created_at)}</p></li>)}</ol></details>}
  </Card>;
}

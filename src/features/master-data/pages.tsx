import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth/permissions";
import { EmployeeStatusPanel } from "@/features/workflows/employee-status-panel";
import {
  entityContext,
  getRecord,
  referenceLabels,
  listRecords,
  masterClient,
  type QueryParams,
} from "./server";
export async function MasterTable({
  entity: key,
  params,
  parent,
}: {
  entity: string;
  params: QueryParams;
  parent?: { field: string; id: string };
}) {
  const context = await entityContext(key, params.branch);
  const data = await listRecords(
    context.entity,
    context.branch,
    {
      ...(parent && key === "kompetensi-personil"
        ? { branch: context.branch, sort: params.sort, dir: params.dir }
        : params),
      page: "1",
    },
    parent,
  );
  return (
    <DataTable
      key={`${key}:${context.branch}:${parent?.id || ""}`}
      entity={context.entity}
      branch={context.branch}
      data={data}
      canWrite={context.canWrite}
      userId={context.user.id}
      isAdmin={hasPermission(context.scopes, context.branch, ["admin"])}
      canManagePasswords={context.scopes.some(
        (s) =>
          s.branch_code === context.branch && s.role_code === "super_admin",
      )}
      parent={parent}
      hideFilters={!!parent && key === "kompetensi-personil"}
    />
  );
}
export async function MasterPage({
  entity: key,
  params,
}: {
  entity: string;
  params: QueryParams;
}) {
  let context;
  try {
    context = await entityContext(key, params.branch);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Anda tidak memiliki")
    )
      return (
        <Card className="p-6">
          <PageHeader
            title="Akses ditolak"
            description="Peran Anda tidak memiliki kewenangan pada data dan cabang yang diminta."
          />
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-primary-hover underline"
          >
            Kembali ke dashboard
          </Link>
        </Card>
      );
    throw error;
  }
  const { entity, branch } = context;
  return (
    <>
      <PageHeader
        title={entity.title}
        description={entity.description}
        eyebrow={`Data cabang ${branch}`}
      />
      <MasterTable entity={key} params={params} />
    </>
  );
}
export async function DetailPage({
  entity: key,
  id,
  params,
  child,
  field,
}: {
  entity: string;
  id: string;
  params: QueryParams;
  child: string;
  field: string;
}) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) notFound();
  const { entity, branch, scopes, profile } = await entityContext(key, params.branch);
  if (key === "pegawai") {
    const db = await masterClient();
    const { data } = await db
      .from("employee_directory")
      .select("merged_into_employee_id")
      .eq("id", id)
      .eq("branch_code", branch)
      .maybeSingle();
    if (data?.merged_into_employee_id)
      redirect(
        `/master-data/pegawai/${data.merged_into_employee_id}?branch=${branch}`,
      );
  }
  const record = await getRecord(entity, branch, id);
  if (!record) notFound();
  const labels = await referenceLabels(entity, branch, record);
  return (
    <>
      <Link
        href={`${entity.path}?branch=${branch}`}
        className="mb-4 inline-block text-xs font-semibold text-primary-hover hover:underline"
      >
        ← Kembali ke {entity.title.toLowerCase()}
      </Link>
      <PageHeader
        title={String(record[entity.labelKey] || entity.singular)}
        description={entity.description}
        eyebrow={`Detail cabang ${branch}`}
      />
      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-2">
        {entity.columns.map((column) => (
          <div key={column}>
            <p className="text-[11px] text-muted-foreground">
              {entity.fields.find((field) => field.key === column)?.label ||
                column}
            </p>
            <p className="mt-1 break-words text-sm font-semibold">
              {column === "npp" && !record[column]
                ? "Non-NPP"
                : labels[column] ||
                  entity.fields
                    .find((f) => f.key === column)
                    ?.options?.find((o) => o.value === record[column])?.label ||
                  (typeof record[column] === "boolean"
                    ? record[column]
                      ? "Aktif"
                      : "Nonaktif"
                    : String(record[column] ?? "—"))}
            </p>
          </div>
        ))}
      </Card>
      {key === "pegawai" && hasPermission(scopes, branch, ["admin", "hrga"]) && <EmployeeStatusPanel branch={branch} row={record} own={profile.employee_id === id}/>}
      <MasterTable
        entity={child}
        params={{ ...params, branch }}
        parent={{ field, id }}
      />
    </>
  );
}

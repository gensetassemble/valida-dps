import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { markNotificationRead } from "@/features/workflows/actions";
import { formatTimestamp } from "@/lib/format";
export default async function NotificationsPage() {
  const { user } = await requireActiveUser(),
    db = await masterClient();
  const { data, error } = await db
    .from("user_notifications")
    .select("id,title,href,read_at,created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw Error("Notifikasi belum dapat dimuat.");
  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Notifikasi</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        100 pemberitahuan terbaru untuk akun Anda. Pemberitahuan proses tidak
        mengubah masa berlaku sertifikat.
      </p>
      <div className="space-y-2">
        {!data?.length && (
          <p className="rounded-xl border border-border bg-white p-5 text-sm">
            Belum ada notifikasi.
          </p>
        )}
        {data?.map((n) => (
          <article
            key={n.id}
            className={
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 " +
              (n.read_at ? "bg-white" : "bg-emerald-50")
            }
          >
            <div>
              <Link href={n.href} className="text-sm font-semibold underline">
                {n.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTimestamp(n.created_at)} ·{" "}
                {n.read_at ? "Sudah dibaca" : "Belum dibaca"}
              </p>
            </div>
            {!n.read_at && (
              <form
                action={async () => {
                  "use server";
                  await markNotificationRead(n.id);
                }}
              >
                <button className="rounded-lg border border-input bg-white px-3 py-2 text-xs">
                  Tandai dibaca
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

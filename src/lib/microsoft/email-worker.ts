import "server-only";
import { getAuthAdminClient } from "@/lib/supabase/auth-admin";
import { getAppConfig } from "@/lib/env/server";
import { getMailDeliveryConfig } from "./delivery-config";
import { deliverMicrosoftEmail } from "./delivery";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function runEmailWorker(options: { branch?: string; job?: string; schedule?: boolean } = {}) {
  const deadline = Date.now() + 240000;
  const config = getMailDeliveryConfig();
  if (!config) return { disabled: true, queued: 0, processed: 0 };
  const db = getAuthAdminClient() as SupabaseClient<Database> | null;
  if (!db) throw Error("Kredensial worker email belum tersedia.");
  // Reconcile abandoned claims even if there are no pending jobs left to process.
  const recovery = await db.rpc("claim_email_deliveries", { batch_size: 1, delivery_mode: config.mode, only_job: "00000000-0000-4000-8000-000000000000" });
  if (recovery.error) throw Error("Status worker sebelumnya belum dapat diperiksa.");
  let queued = 0;
  if (options.schedule && process.env.ENABLE_EMAIL_REMINDERS === "true") {
    const result = await db.rpc("enqueue_due_email_reminders", { delivery_mode: config.mode });
    if (result.error) throw Error("Antrean reminder belum dapat dibentuk.");
    queued = result.data;
  }
  const allowed = ["and(kind.eq.renewal,mode.eq.test)",
    ...(config.mode === "live" && process.env.ENABLE_OUTLOOK_COMMERCIAL === "true" ? ["and(kind.eq.renewal,mode.eq.live)"] : [])];
  if (process.env.ENABLE_EMAIL_REMINDERS === "true") {
    const settings = await db.from("email_reminder_settings").select("branch_code").eq("enabled",true);
    if (settings.error) throw Error("Pengaturan reminder belum dapat diperiksa.");
    const branches = (settings.data || []).map(v => v.branch_code).filter(v => /^[A-Z0-9]{2,8}$/.test(v));
    if (branches.length) allowed.push(`and(kind.eq.reminder,branch_code.in.(${branches.join(",")}))`);
  }
  let query = db.from("email_outbox").select("id,mode,kind,branch_code").eq("state", "pending").in("mode", config.mode === "live" ? ["test","live"] : ["test"]).or(allowed.join(",")).lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(config.mode === "test" ? 3 : 100);
  if (options.branch) query = query.eq("branch_code", options.branch);
  if (options.job) query = query.eq("id", options.job);
  const pending = await query;
  if (pending.error) throw Error("Antrean pengiriman belum dapat dimuat.");
  let processed = 0;
  const remindersEnabled = new Map<string, boolean>();
  for (const selected of pending.data || []) {
    if (Date.now() >= deadline) break;
    if (selected.kind === "reminder") {
      if (!remindersEnabled.has(selected.branch_code)) {
        const setting = await db.from("email_reminder_settings").select("enabled").eq("branch_code",selected.branch_code).maybeSingle();
        if (setting.error) throw Error("Pengaturan reminder belum dapat diperiksa.");
        remindersEnabled.set(selected.branch_code,setting.data?.enabled === true);
      }
      if (!remindersEnabled.get(selected.branch_code)) continue;
    }
    const claimed = await db.rpc("claim_email_deliveries", { batch_size: 1, delivery_mode: selected.mode, only_job: selected.id });
    if (claimed.error) throw Error("Antrean belum dapat dikunci.");
    const job = claimed.data?.[0];
    if (!job) continue;
    if (!job.claim_token) throw Error("Antrean tidak memiliki token penguncian yang valid.");
    let body = job.body;
    if (job.kind === "reminder") {
      const path = job.domain === "clients" ? "sertifikat-klien" : job.domain === "personnel" ? "kompetensi-personil" : "kalibrasi-alat";
      body += `\n\nBuka VALIDA: ${getAppConfig().APP_URL}/${path}/${job.record_id}?branch=${encodeURIComponent(job.branch_code)}`;
    }
    const result = await deliverMicrosoftEmail({ id: job.id, kind: job.kind === "reminder" ? "reminder" : "renewal", to: job.recipient, subject: job.subject, body, test: job.mode === "test" });
    const saved = await db.rpc("finish_email_delivery", { job: job.id, claim: job.claim_token!, result_state: result.state,
      result: result.code, provider_request: result.requestId || "", retry_seconds: result.retryAfter || 300 });
    if (saved.error || !saved.data) throw Error("Hasil pengiriman belum dapat dikonfirmasi. Jangan kirim ulang sebelum audit diperiksa.");
    processed++;
  }
  return { disabled: false, queued, processed };
}

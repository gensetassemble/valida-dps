import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const args = ["gen", "types", "typescript", "--local"];
// Use --local only; a remote project must be explicitly selected and reviewed by an administrator.
const result = spawnSync(process.platform === "win32" ? "supabase.cmd" : "supabase", args, { encoding: "utf8", shell: process.platform === "win32" });
if (result.status !== 0 || !result.stdout.includes("export type Database")) { console.error("Gagal membuat tipe. Pastikan runtime Supabase lokal berjalan; berkas lama dipertahankan."); process.exit(1); }
writeFileSync("src/types/database.ts", result.stdout);

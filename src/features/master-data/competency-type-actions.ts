"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { entityContext, masterClient } from "./server";

const schema = z
  .object({
    branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
    name: z.string().trim().min(2).max(160),
  })
  .strict();

export async function createCompetencyType(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: "Isi nama jenis kompetensi (2–160 karakter)." };
  const { branch } = await entityContext(
    "kompetensi-personil",
    parsed.data.branch,
    true,
  );
  const db = await masterClient();
  const { data, error } = await db.rpc("create_personnel_competency_type", {
    b: branch,
    type_name: parsed.data.name,
  });
  if (error || !data?.[0])
    return {
      error:
        error?.code === "P0001"
          ? error.message.slice(0, 300)
          : "Jenis kompetensi belum tersimpan. Periksa akses dan coba kembali.",
    };
  revalidatePath("/master-data/jenis-sertifikat");
  return { option: { value: String(data[0].id), label: String(data[0].name) } };
}

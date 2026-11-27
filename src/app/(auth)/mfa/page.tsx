import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/guards";

export default async function MfaPage() {
  await requireActiveUser();
  redirect("/dashboard");
}

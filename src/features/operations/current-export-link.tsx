"use client";
import { useSearchParams } from "next/navigation";
import { FileDown, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CurrentExportLink({ entity, branch, includeInactive = false }: { entity: string; branch: string; includeInactive?: boolean }) {
  const search = useSearchParams();
  const query = new URLSearchParams(search.toString());
  query.set("entity", entity); query.set("branch", branch); query.delete("page");
  if (includeInactive) query.set("include_inactive", "true"); else query.delete("include_inactive");
  return <Button asChild variant="export"><a href={"/api/operations/export?" + query}>
    {includeInactive ? <UserRoundX aria-hidden="true"/> : <FileDown aria-hidden="true"/>}
    {includeInactive ? "Ekspor termasuk personil nonaktif" : "Ekspor XLSX sesuai filter"}
  </a></Button>;
}

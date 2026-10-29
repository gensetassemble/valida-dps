import Content from "@/app/(dashboard)/kompetensi-personil/[id]/ubah/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Ubah Kompetensi Personil">
      <Content {...props} />
    </RouteModal>
  );
}

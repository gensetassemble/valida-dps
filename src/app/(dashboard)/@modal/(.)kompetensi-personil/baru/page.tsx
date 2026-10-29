import Content from "@/app/(dashboard)/kompetensi-personil/baru/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Tambah Kompetensi Personil">
      <Content {...props} />
    </RouteModal>
  );
}

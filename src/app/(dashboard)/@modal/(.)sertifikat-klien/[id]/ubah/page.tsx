import Content from "@/app/(dashboard)/sertifikat-klien/[id]/ubah/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Ubah Sertifikat Klien">
      <Content {...props} />
    </RouteModal>
  );
}

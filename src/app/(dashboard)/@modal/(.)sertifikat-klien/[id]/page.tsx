import Content from "@/app/(dashboard)/sertifikat-klien/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Detail Sertifikat Klien">
      <Content {...props} />
    </RouteModal>
  );
}

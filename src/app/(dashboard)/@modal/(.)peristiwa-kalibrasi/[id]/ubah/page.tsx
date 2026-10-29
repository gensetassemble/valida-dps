import Content from "@/app/(dashboard)/peristiwa-kalibrasi/[id]/ubah/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Ubah Peristiwa Kalibrasi">
      <Content {...props} />
    </RouteModal>
  );
}

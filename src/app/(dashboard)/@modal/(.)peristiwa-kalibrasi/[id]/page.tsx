import Content from "@/app/(dashboard)/peristiwa-kalibrasi/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Detail Peristiwa Kalibrasi">
      <Content {...props} />
    </RouteModal>
  );
}

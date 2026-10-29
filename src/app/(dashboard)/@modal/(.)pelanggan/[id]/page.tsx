import Content from "@/app/(dashboard)/pelanggan/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Detail Pelanggan">
      <Content {...props} />
    </RouteModal>
  );
}

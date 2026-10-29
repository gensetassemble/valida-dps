import Content from "@/app/(dashboard)/kalibrasi-alat/[id]/kalibrasi/baru/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Tambah Peristiwa Kalibrasi">
      <Content {...props} />
    </RouteModal>
  );
}

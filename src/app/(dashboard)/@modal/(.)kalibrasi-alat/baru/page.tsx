import Content from "@/app/(dashboard)/kalibrasi-alat/baru/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Tambah Alat">
      <Content {...props} />
    </RouteModal>
  );
}

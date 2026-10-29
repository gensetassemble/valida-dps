import Content from "@/app/(dashboard)/master-data/[entity]/[id]/page";
import { RouteModal } from "@/components/ui/route-modal";
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Detail Master Data">
      <Content {...props} />
    </RouteModal>
  );
}

import { RouteModal } from "@/components/ui/route-modal";
import { ListLoading } from "@/components/ui/list-loading";
export default function Loading() {
  return <RouteModal title="Memuat rincian"><ListLoading rows={3}/></RouteModal>;
}

import Content from "@/app/(dashboard)/kompetensi-personil/matriks/page";
import { RouteModal } from "@/components/ui/route-modal";

// Reserve this named route so soft navigation cannot treat "matriks" as a record ID.
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <RouteModal title="Matriks Kompetensi">
      <Content {...props} />
    </RouteModal>
  );
}

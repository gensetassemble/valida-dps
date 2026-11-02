import { NotificationInbox } from "@/features/notifications/inbox";
import { loadInbox, parseInboxParams } from "@/features/notifications/server";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filters, page } = parseInboxParams(await searchParams);
  const { feed, counts } = await loadInbox(filters, page);
  return (
    <NotificationInbox
      feed={feed}
      counts={counts}
      filters={filters}
      page={page}
      now={new Date().toISOString()}
    />
  );
}

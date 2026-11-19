import { NotificationInbox } from "@/features/notifications/inbox";
import { loadInbox, parseInboxParams } from "@/features/notifications/server";
import {Suspense} from 'react';
import {UrgentNotifications} from '@/features/notifications/urgent';
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
      priorities={<Suspense fallback={<p className="text-xs text-muted-foreground">Memuat pengingat Expired dan Kritis…</p>}><UrgentNotifications filters={filters}/></Suspense>}
    />
  );
}

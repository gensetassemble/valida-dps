export default function NotificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-4 min-h-[calc(100dvh-8rem)] bg-background p-3 sm:-m-6 sm:p-4 lg:-m-8">
      {children}
    </div>
  );
}

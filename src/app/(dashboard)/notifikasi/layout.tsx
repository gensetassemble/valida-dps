import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
export default function NotificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-4 min-h-[calc(100dvh-8rem)] bg-[#F4F6F1] p-3 sm:-m-6 sm:p-4 lg:-m-8">
      {children}
    </div>
  );
}

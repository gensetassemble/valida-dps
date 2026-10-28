import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "VALIDA | SUCOFINDO Denpasar", template: "%s | VALIDA" },
  description: "Validity Alert & Data Archive — PT SUCOFINDO Cabang Denpasar",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

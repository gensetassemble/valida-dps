import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import { ToastProvider } from "@/components/ui/toast";
import { isTrainingEnvironment } from "@/lib/env/training";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "VALIDA | SUCOFINDO Denpasar", template: "%s | VALIDA" },
  description: "Validity Alert & Data Archive — PT SUCOFINDO Cabang Denpasar",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const training = isTrainingEnvironment();
  return (
    <html lang="id">
      <body className={training ? "pb-12" : undefined}>
        {training && <aside className="fixed inset-x-0 bottom-0 z-[100] border-t border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950" role="status">SANDBOX LATIHAN · Data terpisah dari VALIDA produksi · Perubahan hanya berlaku di sandbox · Email otomatis dinonaktifkan</aside>}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

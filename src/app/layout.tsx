import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "./globals.css";
export const metadata: Metadata = { title: { default: "VALIDA | SUCOFINDO Denpasar", template: "%s | VALIDA" }, description: "Validity Alert & Data Archive — PT SUCOFINDO Cabang Denpasar", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }

import Link from "next/link";
import { Archive, ArrowLeft } from "lucide-react";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12"><Link href="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15}/>Beranda</Link><div className="mb-8 flex items-center gap-3 font-heading text-xl font-bold"><Archive className="text-accent"/>VALIDA</div><section className="rounded-2xl border border-border bg-white p-7 shadow-xs">{children}</section><p className="mt-6 text-center text-xs text-muted-foreground">PT SUCOFINDO Cabang Denpasar · Akses internal</p></main>;
}

import { Archive, ShieldCheck, MapPin } from "lucide-react";
import { APPLICATION_RELEASE } from "@/lib/version";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh">
      <section className="hidden w-[48%] flex-col justify-between bg-brand-navy p-12 text-white lg:flex">
        <div className="text-sm font-bold tracking-[.2em]">
          SUCOFINDO{" "}
          <span className="ml-3 text-xs font-normal tracking-normal text-slate-300">
            Cabang Denpasar
          </span>
        </div>
        <div className="py-16">
          <span className="mb-7 inline-flex size-14 items-center justify-center rounded-xl border border-white/20">
            <Archive size={28} />
          </span>
          <h1 className="text-5xl font-bold tracking-tight">
            VALIDA<span className="text-[#6FD3A3]">.</span>
          </h1>
          <p className="mt-4 text-lg font-medium">
            Validity Alert &amp; Data Archive
          </p>
          <p className="mt-7 max-w-sm border-l-2 border-[#6FD3A3] pl-4 text-sm leading-7 text-slate-200">
            Fondasi data yang tepercaya untuk pengelolaan masa berlaku
            sertifikasi, kompetensi personel, dan kalibrasi peralatan.
          </p>
          <p className="mt-8 flex items-center gap-2 text-xs text-slate-300">
            <MapPin size={15} />
            Bali · Nusa Tenggara Barat · Nusa Tenggara Timur
          </p>
        </div>
        <p className="border-t border-white/15 pt-5 text-[11px] text-slate-300">
          PT SUCOFINDO Cabang Denpasar · Akses internal organisasi
        </p>
      </section>
      <section className="flex flex-1 items-center justify-center bg-surface-muted p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <span className="text-2xl font-bold text-brand-navy">
              VALIDA<span className="text-primary">.</span>
            </span>
            <p className="mt-2 text-[11px] text-muted-foreground">
              PT SUCOFINDO Cabang Denpasar
            </p>
          </div>
          <div className="rounded-xl border-2 border-border bg-white p-6 shadow-sm sm:p-8">
            {children}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0" />
            Akses mengikuti peran dan penugasan akun organisasi.
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Versi {APPLICATION_RELEASE}</p>
        </div>
      </section>
    </main>
  );
}

import { ShieldCheck } from "lucide-react";
import { LoginStory } from "@/components/shared/login-story";
import { APPLICATION_RELEASE } from "@/lib/version";
import Image from "next/image";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh">
      <LoginStory />
      <section className="flex flex-1 items-center justify-center bg-surface-muted p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="rounded-xl border-2 border-border bg-white p-6 shadow-sm sm:p-8">
            <div
              className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-5"
              aria-label="VALIDA · PT SUCOFINDO Cabang Denpasar"
            >
              <Image
                src="/branding/valida-logo.png"
                alt="VALIDA — Validity Alert & Data Archive"
                width={288}
                height={96}
                sizes="(max-width: 480px) 190px, 250px"
                priority
                className="h-auto w-[min(68%,250px)]"
              />
              <div className="shrink-0 border-l border-border pl-4">
                <Image
                  src="/branding/sucofindo-logo.png"
                  alt="Sucofindo"
                  width={80}
                  height={48}
                  className="h-auto w-16 sm:w-20"
                />
                <p className="mt-1 text-center text-[9px] text-muted-foreground">
                  Cabang Denpasar
                </p>
              </div>
            </div>
            {children}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0" />
            Akses mengikuti peran dan penugasan akun organisasi.
          </p>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Versi {APPLICATION_RELEASE}
          </p>
        </div>
      </section>
    </main>
  );
}

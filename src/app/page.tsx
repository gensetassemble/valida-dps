import Link from "next/link";
import { ArrowRight, ArrowUpRight, Archive, ShieldCheck, Mail, LockKeyhole, MapPin, Clock3, Layers3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export default function Home() {
  return <div className="mx-auto max-w-7xl px-6 md:px-12">
    <header className="flex items-center justify-between border-b border-border py-7">
      <Link href="/" aria-label="Beranda VALIDA" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Archive size={21}/></span><span className="font-heading text-xl font-bold tracking-tight">VALIDA<span className="ml-2 text-accent">.</span></span></Link>
      <div className="text-right text-xs leading-5"><strong className="tracking-[.16em]">SUCOFINDO</strong><p className="text-muted-foreground">Cabang Denpasar</p></div>
    </header>
    <main id="main" className="pb-16">
      <div className="grid gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-24">
        <section>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c8ded0] bg-[#e9f1e8] px-3 py-1.5 text-xs font-semibold"><span className="size-1.5 rounded-full bg-accent"/>TAHAP 01 · PERSIAPAN INFRASTRUKTUR</span>
          <h1 className="mt-7 text-5xl font-bold leading-[1.08] tracking-[-.05em] md:text-7xl">Fondasi tepercaya.<br/><span className="text-accent">Kesiapan terjaga.</span></h1>
          <p className="mt-7 font-heading text-lg font-medium">Validity Alert &amp; Data Archive</p>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">Fondasi pengelolaan masa berlaku sertifikasi dan arsip digital untuk PT SUCOFINDO Cabang Denpasar.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link href="/login">Masuk ke VALIDA <ArrowRight/></Link></Button><Button variant="outline" asChild><a href="#kesiapan">Lihat kesiapan <ArrowUpRight/></a></Button></div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={13}/>Akses terbatas untuk akun yang diaktifkan administrator.</p>
        </section>
        <Card className="relative flex flex-col overflow-hidden p-7 md:p-9">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-[.13em] text-muted-foreground">RUANG KERJA CABANG</span><span className="rounded-full bg-muted px-3 py-1 text-xs">Pengembangan</span></div>
          <div className="my-10 flex items-center gap-5"><span className="flex size-20 items-center justify-center rounded-2xl bg-primary font-heading text-2xl font-bold text-white">DPS</span><div><h2 className="text-2xl font-bold">Denpasar</h2><p className="mt-1 text-sm text-muted-foreground">Bali, Nusa Tenggara Barat,<br/>Nusa Tenggara Timur</p></div></div>
          <div className="mt-auto space-y-4 border-t border-border pt-6 text-sm"><p className="flex items-center gap-3"><MapPin size={17} className="text-accent"/>Wilayah operasional Bali–Nusa Tenggara</p><p className="flex items-center gap-3"><Clock3 size={17} className="text-accent"/>WITA · Asia/Makassar · UTC+8</p><p className="flex items-center gap-3"><ShieldCheck size={17} className="text-accent"/>Autentikasi dan kontrol akses disiapkan</p></div>
        </Card>
      </div>
      <section id="kesiapan" className="border-t border-border pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.15em] text-accent">DIBANGUN SECARA BERTAHAP</p><h2 className="mt-2 text-2xl font-bold">Kesiapan fondasi aplikasi</h2></div><p className="text-xs text-muted-foreground">Layanan eksternal diverifikasi secara terpisah.</p></div>
        <div className="grid gap-4 md:grid-cols-3">{[
          { icon: ShieldCheck, title: "Akses yang terkendali", text: "Masuk melalui akun terdaftar. Aktivasi dan kewenangan dikelola administrator.", tag: "Fondasi autentikasi" },
          { icon: Archive, title: "Arsip yang terlindungi", text: "Dokumen sertifikat disiapkan untuk penyimpanan privat. Unggah belum diaktifkan.", tag: "Akses dokumen ditutup" },
          { icon: Mail, title: "Notifikasi Microsoft 365", text: "Menunggu persetujuan Microsoft Entra serta penetapan mailbox resmi organisasi.", tag: "Menunggu otorisasi" },
        ].map(({ icon: Icon, title, text, tag }) => <Card key={title} className="p-6"><Icon size={23} className="text-accent"/><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><p className="mt-6 border-t border-border pt-4 text-xs font-semibold">{tag}</p></Card>)}</div>
      </section>
      <div className="mt-8 flex flex-col gap-4 rounded-xl bg-[#e9ede6] p-5 text-sm md:flex-row md:items-center"><Layers3 className="shrink-0 text-accent" size={20}/><p className="flex-1 leading-6">Modul sertifikasi, kompetensi personel, kalibrasi, dan tindak lanjut akan dikembangkan pada tahap berikutnya.</p><span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold"><Check size={15}/>Tanpa data operasional</span></div>
    </main>
    <footer className="flex flex-wrap justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground"><p>VALIDA · PT SUCOFINDO Cabang Denpasar</p><p>Lingkungan pengembangan · Akses internal</p></footer>
  </div>;
}

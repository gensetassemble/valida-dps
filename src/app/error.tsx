"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-lg p-12"><h1 className="text-2xl font-bold">Layanan belum dapat diakses</h1><p className="my-5">Silakan coba kembali. Hubungi administrator jika kendala berlanjut.</p><Button onClick={reset}>Coba kembali</Button></main>; }

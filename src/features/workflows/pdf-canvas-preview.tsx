"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

function PdfPage({ document, number, width }: { document: PDFDocumentProxy; number: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;
    let render: RenderTask | undefined;
    document.getPage(number).then(async (page) => {
      if (stopped || !canvas.current) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(width, 900) / original.width });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const target = canvas.current;
      target.width = Math.ceil(viewport.width * density);
      target.height = Math.ceil(viewport.height * density);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      render = page.render({ canvas: target, viewport, transform: [density, 0, 0, density, 0, 0] });
      await render.promise;
    }).catch((e) => { if (!stopped && e?.name !== "RenderingCancelledException") setError(true); });
    return () => { stopped = true; render?.cancel(); };
  }, [document, number, width]);
  return error ? <p role="alert" className="p-3 text-sm text-red-800">Halaman {number} belum dapat ditampilkan. Gunakan Unduh PDF.</p> : <canvas ref={canvas} aria-label={`Formulir terisi halaman ${number}`} className="mx-auto max-w-full bg-white shadow-sm"/>;
}

export function PdfCanvasPreview({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(Math.max(180, Math.floor(entries[0].contentRect.width - 24))));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let destroy: (() => void) | undefined;
    async function load() {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/v6.4.299/pdf.worker.min.mjs";
      const response = await fetch(source, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw Error("PDF unavailable");
      const task = pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()), standardFontDataUrl: "/vendor/pdfjs/v6.4.299/standard_fonts/", useWasm: false });
      destroy = () => { void task.destroy(); };
      const pdf = await task.promise;
      if (stopped) destroy(); else setDocument(pdf);
    }
    void load().catch(() => { if (!stopped) setError(true); });
    return () => { stopped = true; controller.abort(); destroy?.(); };
  }, [source]);
  return <div ref={container} className="h-[65dvh] min-h-80 space-y-3 overflow-auto rounded-lg border border-border bg-slate-200 p-3">
    {error ? <p role="alert" className="text-sm text-red-800">Preview belum dapat dimuat. Gunakan Unduh PDF terisi.</p> : document ? Array.from({ length: document.numPages }, (_, i) => <PdfPage key={i} document={document} number={i + 1} width={width}/>) : <p role="status" className="p-3 text-sm">Memuat preview PDF…</p>}
  </div>;
}

"use client";
import { useId, useState } from "react";
import {
  ArrowUpRight,
  Check,
  FileCheck2,
  Gauge,
  MapPin,
  UserRoundCheck,
} from "lucide-react";
import styles from "./login-story.module.css";

const modules = [
  {
    label: "Peralatan",
    icon: Gauge,
    title: "Alat siap. Pekerjaan jalan.",
    description:
      "Cek masa kalibrasi, ajukan perbaikan, dan ikuti progresnya bersama PTK.",
    steps: ["Catat alat", "Pantau kalibrasi", "Ajukan tindak lanjut"],
    caption: "Kalibrasi peralatan",
  },
  {
    label: "Kompetensi",
    icon: UserRoundCheck,
    title: "Lisensi terjaga, tim siap bertugas.",
    description:
      "Lihat sertifikat personil dan ikuti pembaruannya bersama HRGA, tanpa kehilangan riwayat.",
    steps: ["Cek lisensi", "Proses pembaruan", "Catat sertifikat baru"],
    caption: "Kompetensi personil",
  },
  {
    label: "Klien",
    icon: FileCheck2,
    title: "Hubungi klien sebelum jatuh tempo.",
    description:
      "Dari kontak pertama hingga PO diterima, tindak lanjut perpanjangan tercatat untuk Account Manager.",
    steps: ["Hubungi PIC", "Kirim penawaran", "Konfirmasi PO"],
    caption: "Sertifikat klien",
  },
];
export function LoginStory() {
  const [selected, setSelected] = useState(0),
    id = useId();
  const current = modules[selected],
    Icon = current.icon;
  return (
    <section className={styles.panel} aria-label="Tentang VALIDA">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.top}>
        <span className={styles.company}>SUCOFINDO</span>
        <span>Cabang Denpasar</span>
      </div>
      <div className={styles.content}>
        <p className={styles.eyebrow}>
          <span aria-hidden="true" />
          VALIDITY ALERT & DATA ARCHIVE
        </p>
        <h2>
          Cek masa berlaku.
          <br />
          Siapkan
          <br />
          <span>langkah berikutnya.</span>
        </h2>
        <p className={styles.intro}>
          Pantau sertifikat dan kalibrasi. Catat tindak lanjut,
          <br />
          lalu teruskan pekerjaan bersama tim.
        </p>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Kenali modul VALIDA"
        >
          {modules.map((m, index) => (
            <button
              key={m.label}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={selected === index}
              aria-controls={`${id}-panel`}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                if (
                  ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? modules.length - 1
                        : (selected +
                            (event.key === "ArrowRight"
                              ? 1
                              : modules.length - 1)) %
                          modules.length;
                  setSelected(next);
                  event.currentTarget.parentElement
                    ?.querySelectorAll("button")
                    .item(next)?.focus();
                }
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div
          className={styles.card}
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${selected}`}
          tabIndex={0}
        >
          <div className={styles.cardHeader}>
            <span className={styles.icon}>
              <Icon size={21} />
            </span>
            <span>{current.caption}</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </div>
          <div key={selected} className={styles.reveal}>
            <h3>{current.title}</h3>
            <p>{current.description}</p>
            <ol className={styles.steps}>
              {current.steps.map((step, index) => (
                <li key={step}>
                  <span>{index === 0 ? <Check size={12} /> : index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <MapPin size={15} aria-hidden="true" />
        <span>Bali · Nusa Tenggara Barat · Nusa Tenggara Timur</span>
      </div>
    </section>
  );
}

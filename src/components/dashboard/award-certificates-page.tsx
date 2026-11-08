"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import "./award-certificates.css";

/* ---------- Data ---------- */

type Cat = { c: string; d: string; t: string };

const CATS: Record<string, Cat> = {
  "Excellence in Discipline": { c: "#8c1d2c", d: "#5e0f1b", t: "In recognition of exemplary discipline, respect for teachers and peers, and for being a role model to the whole school community." },
  "Sports Excellence": { c: "#d2570f", d: "#8f3503", t: "In recognition of an outstanding contribution to sports and for proudly representing the school in competitions." },
  "Cleanliness & Environment": { c: "#0f7a6e", d: "#09463f", t: "In recognition of exceptional care for personal hygiene, the school environment and property, and for inspiring others to do the same." },
  "Dedication & Hard Work": { c: "#6d3fc0", d: "#42217f", t: "In recognition of remarkable hard work, perseverance and self-motivation in studies and all school activities throughout his/her time with us." },
  "Service & Teamwork": { c: "#1f7a3a", d: "#0f4a21", t: "In recognition of faithful, selfless service to the school, marked by teamwork and responsibility without being asked." },
  "Outstanding Leadership": { c: "#1d4ed8", d: "#112f86", t: "In recognition of leading fellow students with wisdom, integrity and a strong sense of responsibility as a school leader." },
  "Academic Excellence": { c: "#14295c", d: "#0a1636", t: "In recognition of outstanding academic performance throughout Form One to Form Four." },
  "Certificate of Appreciation": { c: "#b0225f", d: "#701238", t: "In sincere appreciation of a valuable contribution and genuine love for our school throughout his/her studies." },
};
const CAT_NAMES = Object.keys(CATS);

type Vals = {
  gov: string;
  dist: string;
  addr: string;
  school: string;
  year: string;
  sig1: string;
  sig2: string;
  cite: string;
  logoL: string;
  logoR: string;
};

const GOLD = "url(#gold)";

/* ---------- Helpers ---------- */

function star(cx: number, cy: number, n: number, R: number, r: number): string {
  const a: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const an = (Math.PI * i) / n - Math.PI / 2;
    a.push((cx + rad * Math.cos(an)).toFixed(2) + "," + (cy + rad * Math.sin(an)).toFixed(2));
  }
  return a.join(" ");
}

function fitOne(el: HTMLElement) {
  el.style.fontSize = "";
  let fs = 30;
  while (el.scrollWidth > el.clientWidth + 1 && fs > 16) {
    fs -= 1;
    el.style.fontSize = fs + "pt";
  }
}

/* ---------- Certificate pieces ---------- */

function Bracket() {
  return (
    <g stroke={GOLD} fill="none" strokeWidth="1.1">
      <path d="M16 40V16h24" />
      <circle cx="16" cy="16" r="1.8" fill={GOLD} />
      <path d="M21 33V21h12" strokeWidth=".5" />
    </g>
  );
}

function Swoosh() {
  return (
    <>
      <polygon points="0,0 66,0 0,43" fill={GOLD} />
      <polygon points="0,0 63,0 0,41" fill="#0f1c3f" />
      <polygon points="0,0 50,0 0,33" fill="var(--ac)" />
      <polygon points="0,0 36,0 0,24" fill="var(--ad)" opacity=".55" />
    </>
  );
}

function Decor() {
  return (
    <svg className="decor" viewBox="0 0 297 210" preserveAspectRatio="none">
      <g fill="none" style={{ stroke: "var(--ac)" }} opacity=".07" strokeWidth=".7">
        {[30, 42, 54, 66, 78, 90].map((r) => (
          <circle key={r} cx="148.5" cy="108" r={r} />
        ))}
      </g>
      <rect x="9" y="9" width="279" height="192" fill="none" stroke="#0f1c3f" strokeWidth="1.7" />
      <rect x="11.2" y="11.2" width="274.6" height="187.6" stroke={GOLD} fill="none" strokeWidth=".6" />
      <rect x="13.5" y="13.5" width="270" height="183" stroke={GOLD} fill="none" strokeWidth="1.1" strokeDasharray="0.1 2.1" strokeLinecap="round" />
      <rect x="16" y="16" width="265" height="178" stroke={GOLD} fill="none" strokeWidth=".35" />
      <g transform="translate(297 0) scale(-1 1)">
        <Bracket />
      </g>
      <g transform="translate(0 210) scale(1 -1)">
        <Bracket />
      </g>
      <Swoosh />
      <g transform="rotate(180 148.5 105)">
        <Swoosh />
      </g>
    </svg>
  );
}

function Rosette({ year }: { year: string }) {
  return (
    <svg className="ros" viewBox="0 0 60 76">
      <polygon points="20,40 13,74 24,68 30,76 35,44" fill="var(--ac)" />
      <polygon points="40,40 47,74 36,68 30,76 25,44" fill="var(--ad)" />
      <polygon points={star(30, 30, 22, 28, 24.5)} fill={GOLD} />
      <circle cx="30" cy="30" r="20" fill="#0f1c3f" stroke="#f1d98a" strokeWidth=".8" />
      <polygon points={star(30, 22, 5, 5, 2.1)} fill={GOLD} />
      <text x="30" y="36" textAnchor="middle" fontFamily="Cinzel,Georgia,serif" fontWeight="700" fontSize="7.5" fill="#f1d98a">
        {year}
      </text>
    </svg>
  );
}

function Logo({ side, src, label }: { side: "l" | "r"; src: string; label: ReactNode }) {
  return (
    <div className={"lg " + side}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="ph">{label}</span>
      )}
    </div>
  );
}

function Certificate({ name, cat, v }: { name: string; cat: string; v: Vals }) {
  const c = CATS[cat];
  const ce = { contentEditable: true, suppressContentEditableWarning: true } as const;
  return (
    <div className="holder">
      <section className="cert" style={{ "--ac": c.c, "--ad": c.d } as CSSProperties}>
        <Decor />
        <div className="inner">
          <Logo side="l" src={v.logoL} label={<>UMOJA<br />LOGO</>} />
          <Logo side="r" src={v.logoR} label={<>SCHOOL<br />LOGO</>} />
          <div className="gov" {...ce}>{v.gov}</div>
          <div className="dist" {...ce}>{v.dist}</div>
          <div className="addr" {...ce}>{v.addr}</div>
          <div className="school" {...ce}>{v.school}</div>
          <div className="kicker">
            <i></i>CERTIFICATE OF AWARD<i></i>
          </div>
          <div className="ribbon" {...ce}>{cat}</div>
          <p className="pre">Presented to</p>
          <div className="name" {...ce}>{name}</div>
          <p className="cite" {...ce}>{v.cite}</p>
          <div className="foot">
            <div className="sig">
              <div {...ce}>{v.sig1}</div>
              <small>Signature &amp; Stamp</small>
            </div>
            <Rosette year={v.year} />
            <div className="sig">
              <div {...ce}>{v.sig2}</div>
              <small>Date: ____ / ____ / {v.year}</small>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AwardCertificatesPage() {
  const [cat, setCat] = useState<string>(CAT_NAMES[0]);
  const [gov, setGov] = useState("United Republic of Tanzania");
  const [dist, setDist] = useState("Singida Municipal Council");
  const [addr, setAddr] = useState("P.O. Box ____, Singida");
  const [school, setSchool] = useState("Mufumbu Secondary School");
  const [year, setYear] = useState("2026");
  const [sig1, setSig1] = useState("Head of School");
  const [sig2, setSig2] = useState("Academic Master");
  const [names, setNames] = useState("");
  const [cite, setCite] = useState(CATS[CAT_NAMES[0]].t);
  const [logoL, setLogoL] = useState("");
  const [logoR, setLogoR] = useState("");
  const [scale, setScale] = useState(1);

  const sheetRef = useRef<HTMLDivElement>(null);

  const list = names.split("\n").map((n) => n.trim()).filter(Boolean);
  const people = list.length ? list : [""];
  const v: Vals = { gov, dist, addr, school, year, sig1, sig2, cite, logoL, logoR };

  // Rebuild the certificates whenever any control changes (same behaviour as the original page)
  const sheetKey = [cat, gov, dist, addr, school, year, sig1, sig2, cite, names, logoL.length, logoL.slice(-24), logoR.length, logoR.slice(-24)].join("\u0001");

  function fitNames() {
    sheetRef.current?.querySelectorAll<HTMLElement>(".name").forEach(fitOne);
  }

  useEffect(() => {
    fitNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKey]);

  useEffect(() => {
    const onFonts = () => fitNames();
    document.fonts?.addEventListener?.("loadingdone", onFonts);
    return () => document.fonts?.removeEventListener?.("loadingdone", onFonts);
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, (el.clientWidth - 32) / (297 * 3.7795)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onCat(e: ChangeEvent<HTMLSelectElement>) {
    const k = e.target.value;
    setCat(k);
    setCite(CATS[k].t);
  }

  function onLogo(setter: (s: string) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => setter(String(r.result));
      r.readAsDataURL(f);
    };
  }

  async function printSheet() {
    const sheet = sheetRef.current;
    if (!sheet) return;

    // Remove any leftover print container from a previous attempt.
    document.getElementById("certificate-print-root")?.remove();

    const gradientId = `gold-print-${Date.now()}`;
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.style.setProperty("--s", "1");

    // Build a clean print-only copy of the certificates. Using the main
    // document (instead of a hidden iframe) makes window.print() reliable
    // in Chrome/Edge and lets @page force A4 landscape.
    const root = document.createElement("div");
    root.id = "certificate-print-root";
    root.className = "vz print";
    root.innerHTML =
      `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d98a"/><stop offset=".5" stop-color="#c9a227"/><stop offset="1" stop-color="#8a6410"/></linearGradient></defs></svg>` +
      clone.outerHTML.replaceAll("url(#gold)", `url(#${gradientId})`);
    document.body.appendChild(root);
    document.body.classList.add("printing-certificates");

    const previousTitle = document.title;
    document.title = "Certificates";
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.title = previousTitle;
      document.body.classList.remove("printing-certificates");
      root.remove();
    };
    const fallbackCleanup = window.setTimeout(cleanup, 60000);
    window.addEventListener(
      "afterprint",
      () => {
        window.clearTimeout(fallbackCleanup);
        cleanup();
      },
      { once: true }
    );

    // Wait for fonts and logo images so the preview is not blank.
    try {
      await document.fonts?.ready;
    } catch {}
    await Promise.all(
      Array.from(root.querySelectorAll("img")).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    window.focus();
    window.print();
  }

  return (
    <div className="space-y-5">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1d98a" />
            <stop offset=".5" stopColor="#c9a227" />
            <stop offset="1" stopColor="#8a6410" />
          </linearGradient>
        </defs>
      </svg>

      <PageHeader
        title="Certificates"
        subtitle="Design and print award certificates."
        action={
          <Button type="button" variant="primary" onClick={printSheet}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        }
      />

      <section className="app-card">
        <div className="app-card-header border-b border-line pb-4">
          <div className="min-w-0">
            <h2 className="app-card-title">Certificate details</h2>
            <p className="app-card-subtitle">Changes update the preview instantly.</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <Field label="Award type">
            <Select value={cat} onChange={onCat}>
              {CAT_NAMES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Government">
            <Input value={gov} onChange={(e) => setGov(e.target.value)} />
          </Field>
          <Field label="District Council">
            <Input value={dist} onChange={(e) => setDist(e.target.value)} />
          </Field>
          <Field label="School address">
            <Input value={addr} onChange={(e) => setAddr(e.target.value)} />
          </Field>
          <Field label="School name">
            <Input value={school} onChange={(e) => setSchool(e.target.value)} />
          </Field>
          <Field label="Year (shown on the seal and date)">
            <Input value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="First signature">
            <Input value={sig1} onChange={(e) => setSig1(e.target.value)} />
          </Field>
          <Field label="Second signature">
            <Input value={sig2} onChange={(e) => setSig2(e.target.value)} />
          </Field>
          <Field label="Left logo (Union)">
            <Input type="file" accept="image/*" onChange={onLogo(setLogoL)} className="py-2" />
          </Field>
          <Field label="Right logo (School)">
            <Input type="file" accept="image/*" onChange={onLogo(setLogoR)} className="py-2" />
          </Field>
          <Field
            label="Student names (one name per line – each name gets its own certificate)"
            className="lg:col-span-2"
          >
            <textarea
              className="app-textarea"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder={"Example:\nAmina Juma Mrisho\nBaraka Daudi Mwakyusa"}
            />
          </Field>
          <Field
            label="Certificate text (changes with the award type; you can edit it)"
            className="lg:col-span-2"
          >
            <textarea
              className="app-textarea"
              value={cite}
              onChange={(e) => setCite(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </Field>
        </div>

        <div className="border-t border-line px-5 py-4">
          <p className="text-xs leading-relaxed text-muted">
            In the print dialog: A4, Landscape, Margins: None, and enable
            “Background graphics”.
          </p>
        </div>
      </section>

      <div className="vz">
        <div
          className="sheet"
          ref={sheetRef}
          style={{ "--s": scale } as CSSProperties}
          onInput={(e) => {
            const t = e.target as HTMLElement;
            if (t.classList?.contains("name")) fitOne(t);
          }}
        >
          <Fragment key={sheetKey}>
            {people.map((n, i) => (
              <Certificate key={i} name={n} cat={cat} v={v} />
            ))}
          </Fragment>
        </div>
      </div>
    </div>
  );
}

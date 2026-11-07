# Maelekezo kwa AI: Weka "Vyeti vya Zawadi" kama ukurasa wa Next.js (shule-matokeo)

**Jinsi ya kutumia:** Nakili kila kitu kuanzia "TASK" hadi mwisho wa faili hii (maelekezo + faili mbili za code), kisha mpe AI yako ya coding (Cursor, Copilot, Claude Code n.k.) ndani ya folda ya mradi (`mufumbu_ss-main`).

---

## TASK (copy everything below this line)

You are working in an existing **Next.js 16 (App Router) + Supabase** project (folder `mufumbu_ss-main`, developed on **Windows**, deployed on **Vercel**).

Add ONE new page: a printable **award-certificate generator** for Form Four graduates. It is already designed and finished. I give you the exact source of two files below: `page.tsx` (a React client component) and `vyeti.css` (scoped styles). The page needs no database, no API and no new packages.

### Golden rule
**Create both files exactly as given. Do NOT redesign, "clean up", restyle, translate, rename classes, convert the CSS to Tailwind or CSS-in-JS, split into many components, or move the CSS into `globals.css`.** All CSS is intentionally scoped under a `.vz` wrapper so it cannot affect the rest of the app, and it must stay in `vyeti.css`. Visual output must be identical to the source (fonts, colours, sizes, spacing).

### Steps
1. Create the folder `app/vyeti-vya-zawadi/` (if the app's protected teacher/admin pages live inside a route group such as `app/(dashboard)/` or similar, create it inside that group instead, so it gets the same layout and auth as the other pages). The URL must be `/vyeti-vya-zawadi`.
2. Create `page.tsx` and `vyeti.css` in that folder with the exact contents below. `page.tsx` must keep `"use client";` as its very first line. (If the project uses plain JavaScript instead of TypeScript, only strip the type annotations and rename to `page.jsx`; change nothing else.)
3. Add a link to the page in the app navigation (sidebar/dashboard/admin menu), labelled **"Vyeti vya Zawadi"**, using `next/link` (`<Link href="/vyeti-vya-zawadi">`) and matching the style of the other nav items.
4. Protect the route the same way the other staff pages are protected (Supabase auth check, `proxy.ts` / `middleware.ts` matcher, or layout guard). Do not weaken protection of any other route and do not edit other pages.
5. Do NOT install packages, do NOT change the Supabase schema, do NOT modify global CSS or the root layout.
6. Verify and fix only real errors (without changing visuals or behaviour):
   - `npm run dev`, open `http://localhost:3000/vyeti-vya-zawadi`: a control panel and an A4-landscape certificate preview must appear.
   - Type some student names (one per line): one certificate per name appears. Change the award type: colours, ribbon title and text change.
   - Click "Chapisha / Hifadhi PDF": the print dialog must show ONLY the certificates (no sidebar/menu), one per A4 landscape page.
   - `npx tsc --noEmit` and `npm run build` must pass.
7. Reply with a short list of files created/changed and anything not completed.

### How the page works (for your checks)
- Printing is done by cloning the certificates into a hidden iframe together with the page's stylesheets, so the app's sidebar/layout never prints. Keep that approach.
- The student name font auto-shrinks (30pt down to 16pt) so a long name stays on one line.
- Text on each certificate is editable by clicking it. Changing any control above the preview rebuilds the certificates (this is intended).
- Uploaded logos (left "Umoja", right "School") are kept only in browser memory for that visit.
- Google Fonts (Cinzel, Cormorant Garamond, Playfair Display, Montserrat) are loaded through the `@import` on the first line of `vyeti.css`; keep it as the first line.

### File 1: `app/vyeti-vya-zawadi/page.tsx`

````tsx
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import "./vyeti.css";

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

const DEFS_HTML =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d98a"/><stop offset=".5" stop-color="#c9a227"/><stop offset="1" stop-color="#8a6410"/></linearGradient></defs></svg>';

const PRINT_CSS = `
@page{size:A4 landscape;margin:0}
html,body{margin:0;padding:0;background:#fff}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.vz.print{background:#fff;min-height:0;padding:0}
.vz .sheet{padding:0;gap:0;display:block}
.vz .holder{width:297mm!important;height:210mm!important;box-shadow:none;break-after:page;page-break-after:always}
.vz .holder:last-child{break-after:auto;page-break-after:auto}
.vz .cert{transform:none!important}
.vz .ph{visibility:hidden}
`;

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

export default function VyetiVyaZawadiPage() {
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
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.style.setProperty("--s", "1");
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => (n instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${n.href}">` : n.outerHTML))
      .join("");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Certificates</title>${styles}<style>${PRINT_CSS}</style></head><body>${DEFS_HTML}<div class="vz print">${clone.outerHTML}</div></body></html>`
    );
    doc.close();
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    await Promise.all(
      links.map(
        (l) =>
          new Promise<void>((res) => {
            if (l.sheet) return res();
            l.addEventListener("load", () => res());
            l.addEventListener("error", () => res());
          })
      )
    );
    try {
      await doc.fonts.ready;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
    try {
      await doc.fonts.ready;
    } catch {}
    win.addEventListener("afterprint", () => iframe.remove());
    win.focus();
    win.print();
  }

  return (
    <div className="vz">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1d98a" />
            <stop offset=".5" stopColor="#c9a227" />
            <stop offset="1" stopColor="#8a6410" />
          </linearGradient>
        </defs>
      </svg>

      <div className="ctrl">
        <label>
          Aina ya zawadi
          <select value={cat} onChange={onCat}>
            {CAT_NAMES.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Serikali
          <input value={gov} onChange={(e) => setGov(e.target.value)} />
        </label>
        <label>
          Halmashauri
          <input value={dist} onChange={(e) => setDist(e.target.value)} />
        </label>
        <label>
          Anuani ya shule
          <input value={addr} onChange={(e) => setAddr(e.target.value)} />
        </label>
        <label>
          Jina la shule
          <input value={school} onChange={(e) => setSchool(e.target.value)} />
        </label>
        <label>
          Mwaka (unaonekana kwenye muhuri na tarehe)
          <input value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label>
          Sahihi ya kwanza
          <input value={sig1} onChange={(e) => setSig1(e.target.value)} />
        </label>
        <label>
          Sahihi ya pili
          <input value={sig2} onChange={(e) => setSig2(e.target.value)} />
        </label>
        <label>
          Nembo ya kushoto (Umoja)
          <input type="file" accept="image/*" onChange={onLogo(setLogoL)} />
        </label>
        <label>
          Nembo ya kulia (Shule)
          <input type="file" accept="image/*" onChange={onLogo(setLogoR)} />
        </label>
        <label className="wide">
          Majina ya wanafunzi (jina moja kila mstari – kila jina litapata cheti chake)
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"Mfano:\nAmina Juma Mrisho\nBaraka Daudi Mwakyusa"}
          />
        </label>
        <label className="wide">
          Maelezo ya cheti (hubadilika kulingana na aina, unaweza kuyahariri)
          <textarea value={cite} onChange={(e) => setCite(e.target.value)} style={{ minHeight: 60 }} />
        </label>
        <div className="wide" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={printSheet}>Chapisha / Hifadhi PDF</button>
          <p className="hint">Kwenye dirisha la kuchapisha: A4, Landscape, Margins: None, na washa “Background graphics”.</p>
        </div>
      </div>

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
  );
}
````

### File 2: `app/vyeti-vya-zawadi/vyeti.css`

````css
@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:wght@500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&family=Montserrat:wght@400;600&display=swap");

.vz{--bg:#eef0f5;--panel:#fff;--text:#14213d;--muted:#5b6478;--line:#d5d9e3;--acc:#14213d;--accText:#fff;background:var(--bg);color:var(--text);font-family:Montserrat,system-ui,sans-serif;min-height:100%;padding:0 0 24px}
.vz *{box-sizing:border-box}
.vz .ctrl{max-width:980px;margin:0 auto;padding:16px;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));background:var(--panel);border:1px solid var(--line);border-radius:12px}
.vz .ctrl label{display:grid;gap:4px;font-size:12px;color:var(--muted);font-weight:600}
.vz .ctrl input,.vz .ctrl select,.vz .ctrl textarea{font:inherit;font-size:14px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.vz .ctrl textarea{min-height:90px;resize:vertical}
.vz .wide{grid-column:1/-1}
.vz button{font:inherit;font-weight:600;padding:11px 18px;border:0;border-radius:8px;background:var(--acc);color:var(--accText);cursor:pointer}
.vz .hint{font-size:12px;color:var(--muted);margin:0}
.vz .sheet{padding:16px;display:flex;flex-direction:column;align-items:center;gap:22px}
.vz .holder{width:calc(297mm*var(--s,1));height:calc(210mm*var(--s,1));box-shadow:0 10px 36px rgba(0,0,0,.3);flex:none}
.vz .cert{width:297mm;height:210mm;transform:scale(var(--s,1));transform-origin:top left;position:relative;overflow:hidden;color:#0f1c3f;
background:radial-gradient(ellipse at 50% 42%,#fffef9 0,#faf3df 70%,#f2e8c8 100%)}
.vz .cert *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.vz .decor{position:absolute;inset:0;width:100%;height:100%}
.vz .inner{position:absolute;left:26mm;right:26mm;top:21mm;bottom:21mm;display:flex;flex-direction:column;align-items:center;text-align:center}
.vz .gov{font:700 11pt Cinzel,Georgia,serif;letter-spacing:.2em;margin-top:1mm;text-transform:uppercase;outline:none}
.vz .dist{font:700 12.5pt Cinzel,Georgia,serif;letter-spacing:.18em;margin-top:1mm;text-transform:uppercase;color:#8a6410;outline:none}
.vz .addr{font:600 8.5pt Montserrat,sans-serif;letter-spacing:.14em;margin-top:1.5mm;color:#5b6478;text-transform:uppercase;outline:none}
.vz .school{font:700 17pt Cinzel,"Playfair Display",Georgia,serif;letter-spacing:.12em;margin-top:2.5mm;text-transform:uppercase;outline:none}
.vz .kicker{display:flex;align-items:center;gap:5mm;margin-top:6mm;font:700 12pt Cinzel,Georgia,serif;letter-spacing:.5em}
.vz .kicker i{display:block;width:30mm;height:.5mm;background:linear-gradient(90deg,transparent,#c9a227)}
.vz .kicker i:last-child{transform:scaleX(-1)}
.vz .ribbon{position:relative;display:inline-block;margin:5mm 0 0;padding:2.4mm 14mm;background:linear-gradient(180deg,var(--ac),var(--ad));color:#fff;border-top:.5mm solid #d4af37;border-bottom:.5mm solid #d4af37;font:800 22pt "Playfair Display",Georgia,serif;letter-spacing:.06em;text-transform:uppercase;outline:none;text-shadow:0 .3mm .6mm rgba(0,0,0,.35)}
.vz .ribbon::before,.vz .ribbon::after{content:"";position:absolute;top:3.5mm;width:14mm;height:100%;background:var(--ad);filter:brightness(.72);z-index:-1}
.vz .ribbon::before{left:-10mm;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,30% 50%)}
.vz .ribbon::after{right:-10mm;clip-path:polygon(0 0,100% 0,70% 50%,100% 100%,0 100%)}
.vz .pre{font:italic 600 14pt "Cormorant Garamond",Georgia,serif;margin:6mm 0 0;color:#5b6478}
.vz .name{font:italic 700 30pt "Playfair Display",Georgia,serif;color:#0f1c3f;border-bottom:.4mm solid #c9a227;min-width:150mm;max-width:210mm;white-space:nowrap;padding:0 10mm;line-height:1.3;outline:none}
.vz .name:empty::before{content:"Student Name";opacity:.3}
.vz .cite{font:600 14.5pt "Cormorant Garamond",Georgia,serif;max-width:190mm;margin:5mm 0 0;line-height:1.4;outline:none}
.vz .foot{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;padding:0 16mm}
.vz .sig{width:60mm;font:600 9pt Montserrat,sans-serif}
.vz .sig div{border-top:.4mm solid #0f1c3f;padding-top:1.5mm;outline:none}
.vz .sig small{display:block;font-weight:400;color:#5b6478;margin-top:.5mm;font-size:7.5pt}
.vz .lg{position:absolute;top:7mm;width:27mm;height:27mm;display:flex;align-items:center;justify-content:center}
.vz .lg.l{left:0}
.vz .lg.r{right:0}
.vz .lg img{max-width:100%;max-height:100%;object-fit:contain}
.vz .ph{width:100%;height:100%;border:.4mm dashed #c9a227;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 6.5pt Montserrat,sans-serif;color:#8a6410;opacity:.7;text-align:center;letter-spacing:.1em}
.vz .ros{width:23mm;height:29mm;margin-bottom:-1mm}
````

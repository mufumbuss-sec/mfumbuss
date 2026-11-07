"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { sortStudentsForDisplay } from "@/lib/student-sort";

type StudentEntry = {
  id: string;
  full_name: string;
  sex?: string | null;
};

type ExamRecord = {
  id: string;
  name: string;
  class_form: string;
  term: string;
  academic_year: string;
  start_date?: string | null;
  end_date?: string | null;
};

type SubjectRecord = {
  id: string;
  name: string;
  subject_code?: string | null;
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function ISALDocument({
  exam,
  subject,
  students,
  schoolName,
  dashboardBase,
}: {
  exam: ExamRecord;
  subject: SubjectRecord;
  students: StudentEntry[];
  schoolName: string;
  dashboardBase: string;
}) {
  const sortedStudents = sortStudentsForDisplay(students);
  const femaleCount = sortedStudents.filter((student) =>
    (student.sex ?? "").trim().toUpperCase() === "F" ||
    (student.sex ?? "").trim().toUpperCase() === "FEMALE" ||
    (student.sex ?? "").trim().toUpperCase() === "GIRL",
  ).length;
  const maleCount = sortedStudents.filter((student) =>
    (student.sex ?? "").trim().toUpperCase() === "M" ||
    (student.sex ?? "").trim().toUpperCase() === "MALE" ||
    (student.sex ?? "").trim().toUpperCase() === "BOY",
  ).length;

  const handlePrint = () => {
    const previousFrame = document.getElementById("isal-print-frame");
    if (previousFrame) previousFrame.remove();

    const rows = sortedStudents.length
      ? sortedStudents
          .map(
            (student, index) => `
              <tr>
                <td class="cell-center">${index + 1}</td>
                <td class="cell-name">${escapeHtml(student.full_name)}</td>
                <td class="cell-center">${escapeHtml((student.sex || "—").toUpperCase())}</td>
                <td class="cell-center"></td>
                <td class="cell-center"></td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td class="empty" colspan="5">No students are registered for this subject in this class.</td></tr>`;

    const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(exam.name ?? "ISAL")}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12pt;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .doc { width: 100%; }
            .header {
              text-align: center;
              border-bottom: 1.5pt solid #000;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .school {
              font-size: 12pt;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            h1 {
              margin: 6px 0 4px;
              font-size: 18pt;
              line-height: 1.2;
              text-transform: uppercase;
            }
            .meta { font-size: 12pt; line-height: 1.35; }
            .summary {
              margin: 6px 0;
              text-align: right;
              font-size: 12pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              border: 1pt solid #000;
            }
            col.sn-col { width: 8%; }
            col.name-col { width: 34%; }
            col.gender-col { width: 10%; }
            col.signature-col { width: 24%; }
            col.marks-col { width: 24%; }
            thead { display: table-header-group; }
            th, td {
              border: 0.75pt solid #000;
              padding: 4px;
              font-size: 12pt;
              line-height: 1.25;
              vertical-align: middle;
            }
            thead th {
              background: #eef0f3;
              text-align: center;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            .cell-center { text-align: center; }
            .cell-name {
              text-align: left;
              font-weight: 600;
              word-break: break-word;
              overflow-wrap: anywhere;
            }
            .empty {
              padding: 18px 8px;
              text-align: center;
              font-style: italic;
            }
            tbody tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            tbody tr:nth-child(even) td { background: #fafafa; }
            .footer {
              margin-top: 10px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 24px;
              font-size: 12pt;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .sig {
              border-top: 0.75pt solid #000;
              padding-top: 4px;
              line-height: 1.5;
            }
            .sig strong {
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <div class="school">${escapeHtml(schoolName || "School Name")}</div>
              <h1>Individual Subject Attendance List</h1>
              <div class="meta">${escapeHtml(exam.name)} &mdash; ${escapeHtml(exam.term)} &mdash; ${escapeHtml(exam.academic_year)}</div>
              <div class="meta">Class/Form: <strong>${escapeHtml(exam.class_form)}</strong></div>
              <div class="meta">Subject: <strong>${escapeHtml(subject.name)}</strong>${subject.subject_code ? ` &middot; Code: <strong>${escapeHtml(subject.subject_code)}</strong>` : ""}</div>
            </div>

            <div class="summary">Total: ${sortedStudents.length} | Female: ${femaleCount} | Male: ${maleCount}</div>

            <table>
              <colgroup>
                <col class="sn-col" />
                <col class="name-col" />
                <col class="gender-col" />
                <col class="signature-col" />
                <col class="marks-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Student Full Name</th>
                  <th>Gender</th>
                  <th>Signature</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <div class="footer">
              <div class="sig">
                <strong>Invigilator 1</strong><br />
                Name: ______________________________<br />
                Signature: _________________________
              </div>
              <div class="sig">
                <strong>Invigilator 2</strong><br />
                Name: ______________________________<br />
                Signature: _________________________
              </div>
              <div class="sig">
                <strong>Subject Teacher</strong><br />
                Name: ______________________________<br />
                Signature: _________________________
              </div>
              <div class="sig">
                <strong>Date</strong><br />
                _______________________________
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Print through a hidden iframe: no popup blockers and no blank tab.
    const frame = document.createElement("iframe");
    frame.id = "isal-print-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      return;
    }

    frameDocument.open();
    frameDocument.write(printHtml);
    frameDocument.close();

    let printed = false;
    const removeFrame = () => {
      if (frame.isConnected) frame.remove();
    };
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        window.setTimeout(removeFrame, 1000);
      }
    };

    frameWindow.onafterprint = removeFrame;
    if (frameDocument.readyState === "complete") {
      window.setTimeout(triggerPrint, 150);
    } else {
      frameWindow.addEventListener("load", () => window.setTimeout(triggerPrint, 150), {
        once: true,
      });
      window.setTimeout(triggerPrint, 800);
    }
  };

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        .isal-print-shell {
          width: 100%;
        }

        .isal-document {
          background: #fff;
          color: #000;
          border: 1px solid #000;
        }

        .isal-table-wrap {
          margin-top: 10px;
          overflow-x: auto;
          border: 1px solid #000;
        }

        .isal-document table {
          width: 100%;
          min-width: 520px;
          border-collapse: collapse;
          table-layout: fixed;
          background: #fff;
        }

        .isal-document col.sn-col { width: 8%; }
        .isal-document col.name-col { width: 34%; }
        .isal-document col.gender-col { width: 10%; }
        .isal-document col.signature-col { width: 24%; }
        .isal-document col.marks-col { width: 24%; }

        .isal-document thead { display: table-header-group; }

        .isal-document th,
        .isal-document td {
          border: 1px solid #000;
          padding: 6px;
          color: #000;
          font-size: 11px;
          line-height: 1.3;
          vertical-align: middle;
        }

        .isal-document thead th {
          background: #f1f5f9;
          text-align: center;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .isal-document .cell-center { text-align: center; }

        .isal-document .cell-name {
          text-align: left;
          font-weight: 600;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .isal-document .empty {
          padding: 20px 8px;
          text-align: center;
          font-style: italic;
        }

        .isal-document tbody tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .isal-document tbody tr:nth-child(even) td {
          background: #fafafa;
        }

        @media (min-width: 640px) {
          .isal-document th,
          .isal-document td { font-size: 12px; }
        }

        @media print {
          .no-print { display: none !important; }

          .isal-document {
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .isal-document,
          .isal-document * {
            color: #000 !important;
            font-size: 12pt !important;
            line-height: 1.25 !important;
          }

          .isal-document h1 { font-size: 18pt !important; }

          .isal-table-wrap {
            margin-top: 10px !important;
            overflow: visible !important;
            border: 0 !important;
          }

          .isal-document table {
            min-width: 0 !important;
            width: 100% !important;
            border: 1pt solid #000 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          .isal-document th,
          .isal-document td {
            border: 0.75pt solid #000 !important;
            padding: 4px !important;
            font-size: 12pt !important;
            line-height: 1.25 !important;
          }

          .isal-document thead th {
            background: #eef0f3 !important;
            text-align: center !important;
          }

          .isal-document .cell-name { text-align: left !important; }
          .isal-document .cell-center { text-align: center !important; }

          .isal-document tbody tr:nth-child(even) td {
            background: #fafafa !important;
          }
        }
      `}</style>

      <div className="isal-print-shell mx-auto w-full max-w-6xl space-y-3 pb-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Link
            href={`${dashboardBase}/exams/${exam.id}/isal`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ISAL list
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

        <div className="isal-document rounded-2xl bg-white p-4">
          <header className="border-b border-black pb-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-800">
              {schoolName}
            </p>
            <h1 className="mt-1 text-lg font-black uppercase tracking-wide text-black sm:text-xl">
              Individual Subject Attendance List
            </h1>
            <p className="mt-1 text-sm font-semibold text-black">
              {exam.name.toUpperCase()} — {exam.term} — {exam.academic_year}
            </p>
            <p className="text-sm text-black">
              Class/Form: <span className="font-bold">{exam.class_form}</span>
            </p>
            <div className="mt-2 flex flex-col items-center gap-1 text-sm text-black sm:flex-row sm:justify-center sm:gap-4">
              <span>
                Subject: <span className="font-bold">{subject.name}</span>
              </span>
              {subject.subject_code ? (
                <span>
                  Code: <span className="font-bold">{subject.subject_code}</span>
                </span>
              ) : null}
              <span>
                Date: <span className="font-semibold">__________________</span>
              </span>
            </div>
          </header>

          <div className="mt-3 text-right text-[11px] font-semibold uppercase tracking-wide text-black">
            Total: {sortedStudents.length} | Female: {femaleCount} | Male: {maleCount}
          </div>

          <div className="isal-table-wrap">
            <table>
              <colgroup>
                <col className="sn-col" />
                <col className="name-col" />
                <col className="gender-col" />
                <col className="signature-col" />
                <col className="marks-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Student Full Name</th>
                  <th>Gender</th>
                  <th>Signature</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td className="empty" colSpan={5}>
                      No students are registered for this subject in this class.
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td className="cell-center font-semibold">{index + 1}</td>
                      <td className="cell-name">{student.full_name}</td>
                      <td className="cell-center font-semibold uppercase">
                        {student.sex || "—"}
                      </td>
                      <td className="cell-center" aria-label="Student signature" />
                      <td className="cell-center" aria-label="Student marks" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2 sm:text-xs">
            <div className="signature-block border-t border-black pt-2">
              <p className="font-semibold uppercase tracking-wide text-black">Invigilator 1</p>
              <p className="mt-2">Name: ______________________________</p>
              <p className="mt-2">Signature: _________________________</p>
            </div>
            <div className="signature-block border-t border-black pt-2">
              <p className="font-semibold uppercase tracking-wide text-black">Invigilator 2</p>
              <p className="mt-2">Name: ______________________________</p>
              <p className="mt-2">Signature: _________________________</p>
            </div>
            <div className="signature-block border-t border-black pt-2">
              <p className="font-semibold uppercase tracking-wide text-black">Subject Teacher</p>
              <p className="mt-2">Name: ______________________________</p>
              <p className="mt-2">Signature: _________________________</p>
            </div>
            <div className="signature-block border-t border-black pt-2">
              <p className="font-semibold uppercase tracking-wide text-black">Date</p>
              <p className="mt-2">_______________________________</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

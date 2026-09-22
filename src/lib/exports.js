// ==========================================
// DELIVERABLE GENERATION
// ==========================================
//
// Produces the files a document production actually consists of. Everything
// here is generated from real matter state — nothing is a fixed placeholder.

import { formatCitation } from './citations.js';

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function triggerDownload(filename, content, mime) {
  triggerBlobDownload(filename, new Blob([content], { type: mime }));
}

export function triggerBlobDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// jsPDF is ~350KB. It is loaded on first PDF export so that opening the app,
// or leaving with CSV only, never pays for it.
let jspdfPromise = null;
function loadJsPdf() {
  if (!jspdfPromise) jspdfPromise = import('jspdf').then(m => m.jsPDF || m.default.jsPDF);
  return jspdfPromise;
}

export const IMPRINT = {
  firm: 'Avant Society',
  line: 'Case Intelligence',
};

const PAGE_WIDTH = 612;   // US Letter at 72dpi, the format a production is served in
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const LINE_HEIGHT = 12;
const BODY_SIZE = 9;

/**
 * Lays plain text out as a paginated PDF, with the matter caption repeated at
 * the head of every page and a page number at the foot — the form a document
 * served on opposing counsel has to take.
 */
export async function renderTextPdf({ title, caption, body }) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  doc.setProperties({ title, author: IMPRINT.firm });

  const usableWidth = PAGE_WIDTH - MARGIN * 2;

  // Times for the body. It is a serif, which is what a served document should
  // be set in, and it is built into the PDF format — so it costs no embedded
  // font weight and renders identically on any reader.
  doc.setFont('times', 'normal');
  doc.setFontSize(BODY_SIZE);

  // splitTextToSize wraps on width; existing newlines are preserved.
  const lines = body.split('\n').flatMap(line =>
    line.length === 0 ? [''] : doc.splitTextToSize(line, usableWidth)
  );

  const firstLineY = MARGIN + 34;
  const footerY = PAGE_HEIGHT - MARGIN + 14;
  const linesPerPage = Math.floor((footerY - 20 - firstLineY) / LINE_HEIGHT);

  const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage();

    // Letterhead: the imprint, then the matter caption, then a rule. Repeated
    // on every page, because pages of a production get separated.
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 95);           // the navy the interface uses
    doc.text(IMPRINT.firm.toUpperCase(), MARGIN, MARGIN);

    doc.setFont('times', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(IMPRINT.line, PAGE_WIDTH - MARGIN, MARGIN, { align: 'right' });

    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60);
    doc.text(caption, MARGIN, MARGIN + 13);

    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, MARGIN + 19, PAGE_WIDTH - MARGIN, MARGIN + 19);

    doc.setFont('times', 'normal');
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(28, 25, 23);           // the same warm charcoal as the interface
    lines.slice(page * linesPerPage, (page + 1) * linesPerPage).forEach((line, i) => {
      doc.text(line, MARGIN, firstLineY + i * LINE_HEIGHT);
    });

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY - 10, PAGE_WIDTH - MARGIN, footerY - 10);

    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(`Prepared by ${IMPRINT.firm}`, MARGIN, footerY);
    doc.text(`Page ${page + 1} of ${pageCount}`, PAGE_WIDTH - MARGIN, footerY, { align: 'right' });
  }

  return doc.output('blob');
}

export function byteLabel(content) {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** FRCP 26(b)(5) privilege log — what was withheld, on what basis, and why. */
export function buildPrivilegeLog({ caseTitle, documents, privilege, bates }) {
  const withheld = documents.filter(d => privilege[d.name]?.status !== 'produce');
  const rows = [
    ['Bates', 'Document', 'Date Ingested', 'Disposition', 'Basis', 'Description'],
    ...withheld.map(d => [
      bates[d.name] || '(not assigned)',
      d.name,
      d.ingestedAt?.slice(0, 10) || '',
      privilege[d.name]?.status === 'redact' ? 'Produced in redacted form' : 'Withheld',
      privilege[d.name]?.basis || '',
      privilege[d.name]?.description || '',
    ]),
  ];
  // The CSV is for loading into a review platform; the printable rendition is
  // what actually gets served, one entry per block so a basis and description
  // of any length stays readable.
  const printable = [
    `${IMPRINT.firm.toUpperCase()} — ${IMPRINT.line}`,
    ``,
    `PRIVILEGE LOG`,
    `${caseTitle}`,
    `Prepared under FRCP 26(b)(5)`,
    `Generated ${new Date().toLocaleString()}`,
    ``,
    '='.repeat(64),
    ``,
    withheld.length === 0
      ? 'No documents were withheld or redacted.'
      : withheld.map((d, i) => [
          `${i + 1}. ${bates[d.name] || '(Bates not assigned)'} — ${d.name}`,
          `   Disposition: ${privilege[d.name]?.status === 'redact' ? 'Produced in redacted form' : 'Withheld in full'}`,
          `   Basis: ${privilege[d.name]?.basis || '(not stated)'}`,
          `   Description: ${privilege[d.name]?.description || '(not stated)'}`,
          `   Date ingested: ${d.ingestedAt?.slice(0, 10) || '—'}`,
        ].join('\n')).join('\n\n'),
  ].join('\n');

  return {
    filename: `${slug(caseTitle)}-privilege-log.csv`,
    mime: 'text/csv',
    content: `${imprintHeader('Privilege Log', caseTitle)}Prepared under FRCP 26(b)(5)\r\n\r\n${toCsv(rows)}`,
    printable,
    pdfFilename: `${slug(caseTitle)}-privilege-log.pdf`,
    caption: `Privilege Log — ${caseTitle}`,
    count: withheld.length,
  };
}

/** The index that accompanies a production: what was produced, at what Bates range. */
export function buildProductionIndex({ caseTitle, documents, privilege, bates }) {
  const produced = documents.filter(d => privilege[d.name]?.status === 'produce');
  const rows = [
    ['Bates', 'Document', 'Type', 'Pages', 'Pages Exact', 'SHA-256'],
    ...produced.map(d => [
      bates[d.name] || '(not assigned)',
      d.name,
      d.type,
      d.pages,
      d.pagesExact ? 'yes' : 'estimated',
      d.hash,
    ]),
  ];
  return {
    filename: `${slug(caseTitle)}-production-index.csv`,
    mime: 'text/csv',
    content: `${imprintHeader('Production Index', caseTitle)}\r\n${toCsv(rows)}`,
    count: produced.length,
  };
}

/** The strategic brief, built from the citations actually extracted. */
export function buildBrief({ caseTitle, memoText, citations, bates, notes, approval }) {
  const body = citations
    .map((c, i) => {
      const cite = formatCitation(c, bates[c.source]);
      const note = notes[`${c.source}::${c.id}`];
      return [
        `${i + 1}. ${cite}`,
        `   "${c.excerpt}"`,
        note ? `   Attorney note: ${note}` : null,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');

  const content = [
    `PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT`,
    ``,
    `${IMPRINT.firm.toUpperCase()} — ${IMPRINT.line}`,
    ``,
    `${caseTitle}`,
    `Strategic Evaluation`,
    `Generated ${new Date().toLocaleString()}`,
    approval?.by
      ? `Approved for packaging by ${approval.by} on ${new Date(approval.at).toLocaleString()}`
      : `Not yet approved for packaging`,
    ``,
    `${'='.repeat(64)}`,
    ``,
    memoText.trim(),
    ``,
    `${'='.repeat(64)}`,
    `RECORD CITATIONS`,
    ``,
    body || '(No citations extracted.)',
  ].join('\n');

  return {
    filename: `${slug(caseTitle)}-strategic-brief.txt`,
    mime: 'text/plain',
    content,
    printable: content,
    pdfFilename: `${slug(caseTitle)}-strategic-brief.pdf`,
    caption: `Privileged & Confidential — ${caseTitle}`,
    count: citations.length,
  };
}

/**
 * Documents held back from production, why, and what will cure each one.
 * This is the artifact that lets a firm show its production was complete as to
 * what was producible, and account for what was not.
 */
export function buildExceptionsReport({ caseTitle, exceptions }) {
  const rows = [
    ['Bates', 'Document', 'Defect', 'Required Action'],
    ...exceptions.flatMap(item =>
      item.defects.map(defect => [
        item.bates || '(not assigned)',
        item.name,
        defect.label,
        defect.cure,
      ])
    ),
  ];
  return {
    filename: `${slug(caseTitle)}-exceptions-report.csv`,
    mime: 'text/csv',
    content: `${imprintHeader('Exceptions Report', caseTitle)}`
      + `Documents held back from production pending the actions below.\r\n\r\n${toCsv(rows)}`,
    count: exceptions.length,
  };
}

/** Append-only custody and activity log. */
export function buildAuditLog({ caseTitle, auditLog }) {
  const rows = [
    ['Timestamp', 'Actor', 'Action', 'Target'],
    ...auditLog.map(e => [e.ts, e.actor, e.action, e.target || '']),
  ];
  return {
    filename: `${slug(caseTitle)}-audit-log.csv`,
    mime: 'text/csv',
    content: `${imprintHeader('Review Ledger', caseTitle)}Append-only. Entries are never edited or removed.\r\n\r\n${toCsv(rows)}`,
    count: auditLog.length,
  };
}

/** The standing header every generated artifact carries. */
function imprintHeader(docType, caseTitle) {
  return `${IMPRINT.firm} — ${docType}\r\n${caseTitle}\r\nGenerated ${new Date().toLocaleString()}\r\n`;
}

function slug(text) {
  return (text || 'matter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'matter';
}

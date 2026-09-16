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
  doc.setProperties({ title });

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  doc.setFont('courier', 'normal');
  doc.setFontSize(BODY_SIZE);

  // splitTextToSize wraps on width; existing newlines are preserved.
  const lines = body.split('\n').flatMap(line =>
    line.length === 0 ? [''] : doc.splitTextToSize(line, usableWidth)
  );

  const firstLineY = MARGIN + 22;
  const footerY = PAGE_HEIGHT - MARGIN + 14;
  const linesPerPage = Math.floor((footerY - 16 - firstLineY) / LINE_HEIGHT);

  const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage();

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(caption.toUpperCase(), MARGIN, MARGIN);
    doc.setDrawColor(150);
    doc.line(MARGIN, MARGIN + 6, PAGE_WIDTH - MARGIN, MARGIN + 6);

    doc.setFont('courier', 'normal');
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(20);
    lines.slice(page * linesPerPage, (page + 1) * linesPerPage).forEach((line, i) => {
      doc.text(line, MARGIN, firstLineY + i * LINE_HEIGHT);
    });

    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(`Page ${page + 1} of ${pageCount}`, PAGE_WIDTH - MARGIN, footerY, { align: 'right' });
    doc.setTextColor(20);
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
    content: `Privilege Log — ${caseTitle}\r\nGenerated ${new Date().toISOString()}\r\n\r\n${toCsv(rows)}`,
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
    content: `Production Index — ${caseTitle}\r\nGenerated ${new Date().toISOString()}\r\n\r\n${toCsv(rows)}`,
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
    content: `Exceptions Report — ${caseTitle}\r\nGenerated ${new Date().toISOString()}\r\n`
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
    content: `Audit Log — ${caseTitle}\r\nGenerated ${new Date().toISOString()}\r\n\r\n${toCsv(rows)}`,
    count: auditLog.length,
  };
}

function slug(text) {
  return (text || 'matter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'matter';
}

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
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  return {
    filename: `${slug(caseTitle)}-privilege-log.csv`,
    mime: 'text/csv',
    content: `Privilege Log — ${caseTitle}\r\nGenerated ${new Date().toISOString()}\r\n\r\n${toCsv(rows)}`,
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
export function buildBrief({ caseTitle, memoText, citations, bates, notes }) {
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
    count: citations.length,
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

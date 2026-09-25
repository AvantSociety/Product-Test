// Renders the PDFs for the stress-test matter.
//
// Text PDFs are printed from HTML by Chromium, so they carry a real text layer
// and exact page counts, like a PDF saved from Word. "Scanned" PDFs are a
// screenshot of the page embedded as an image, with no text layer at all,
// the way a copier produces them. The app should hold those back for OCR.

import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright');

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page_ = (text, scan) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.9in 1in; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 11.5pt; line-height: 1.45; color: #111;
         ${scan ? 'margin: 60px 70px; transform: rotate(-0.6deg); filter: contrast(1.15) blur(0.35px); background: #f4f1ea;' : ''} }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
</style></head><body><pre>${esc(text)}</pre></body></html>`;

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });

for (const job of jobs) {
  if (job.scan) {
    await page.setContent(page_(job.text, true));
    const png = (await page.screenshot({ fullPage: false })).toString('base64');
    await page.setContent(`<!doctype html><html><head><style>@page{size:Letter;margin:0}body{margin:0}
      img{width:8.5in;height:11in;display:block}</style></head><body><img src="data:image/png;base64,${png}"></body></html>`);
    await page.pdf({ path: job.out, format: 'Letter', printBackground: true });
  } else {
    await page.setContent(page_(job.text, false));
    await page.pdf({ path: job.out, format: 'Letter' });
  }
}
await browser.close();
console.log(`${jobs.length} PDFs rendered`);

// Fetches the search model into public/models/ so it is committed to this
// repository and served from this site. Run once by a maintainer, with
// network access to huggingface.co:
//
//   node scripts/fetch-model.mjs
//
// The app never runs this and never contacts huggingface.co: the worker has
// remote model loading switched off. Every file's SHA-256 is written to
// MANIFEST.json beside it, and the ONNX weights are checked against the
// SHA-256 Hugging Face publishes for them (the X-Linked-Etag header). That
// header is on Hugging Face's redirect to its CDN, not on the file itself, so
// it is read from a request that does not follow the redirect.
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO = 'Xenova/all-MiniLM-L6-v2';
const REVISION = process.argv[2] || 'main';
// README.md is the model card, which states the licence (Apache-2.0).
const FILES = ['README.md', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];
// The model repository has no licence file; Apache-2.0 requires one to go
// with the redistributed files, so the canonical text is saved as LICENSE.
const LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0.txt';
const LICENSE_SHA256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30';
// Stored in Git LFS, so Hugging Face publishes a SHA-256 for them; a missing
// one is an error rather than a skipped check.
const MUST_VERIFY = new Set(['onnx/model_quantized.onnx']);
const OUT = fileURLToPath(new URL(`../public/models/${REPO}/`, import.meta.url));

const manifest = { repo: REPO, requested: REVISION, commit: null, files: {} };
for (const file of FILES) {
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`;
  const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  if (head.status >= 400) throw new Error(`${file}: HTTP ${head.status}`);
  manifest.commit ??= head.headers.get('x-repo-commit');
  const published = (head.headers.get('x-linked-etag') || '').replace(/"/g, '');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (/^[0-9a-f]{64}$/.test(published)) {
    if (published !== sha256) throw new Error(`${file}: SHA-256 ${sha256} does not match the published ${published}`);
  } else if (MUST_VERIFY.has(file)) {
    throw new Error(`${file}: Hugging Face published no SHA-256 to check against`);
  }
  mkdirSync(dirname(OUT + file), { recursive: true });
  writeFileSync(OUT + file, bytes);
  manifest.files[file] = { bytes: bytes.length, sha256, publishedSha256: published || null };
  console.log(`${file}: ${(bytes.length / 1e6).toFixed(2)} MB, sha256 ${sha256}`);
}
const licence = Buffer.from(await (await fetch(LICENSE_URL)).arrayBuffer());
const licenceSha = createHash('sha256').update(licence).digest('hex');
if (licenceSha !== LICENSE_SHA256) throw new Error(`LICENSE: SHA-256 ${licenceSha} is not the Apache-2.0 text`);
writeFileSync(`${OUT}LICENSE`, licence);
manifest.license = { spdx: 'Apache-2.0', source: LICENSE_URL, sha256: licenceSha };
writeFileSync(`${OUT}MANIFEST.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote public/models/${REPO}/ at commit ${manifest.commit}`);

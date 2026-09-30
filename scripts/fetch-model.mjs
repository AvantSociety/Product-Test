// Fetches the search model into public/models/ so it is committed to this
// repository and served from this site. Run once by a maintainer, with
// network access to huggingface.co:
//
//   node scripts/fetch-model.mjs
//
// The app never runs this and never contacts huggingface.co: the worker has
// remote model loading switched off. Every file's SHA-256 is written to
// MANIFEST.json beside it, and the ONNX weights are checked against the
// SHA-256 Hugging Face publishes for them (the X-Linked-Etag header).
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO = 'Xenova/all-MiniLM-L6-v2';
const REVISION = process.argv[2] || 'main';
const FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx'];
const OUT = fileURLToPath(new URL(`../public/models/${REPO}/`, import.meta.url));

const manifest = { repo: REPO, requested: REVISION, commit: null, files: {} };
for (const file of FILES) {
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  manifest.commit ??= res.headers.get('x-repo-commit');
  const bytes = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const published = (res.headers.get('x-linked-etag') || '').replace(/"/g, '');
  if (/^[0-9a-f]{64}$/.test(published) && published !== sha256) {
    throw new Error(`${file}: SHA-256 ${sha256} does not match the published ${published}`);
  }
  mkdirSync(dirname(OUT + file), { recursive: true });
  writeFileSync(OUT + file, bytes);
  manifest.files[file] = { bytes: bytes.length, sha256, publishedSha256: published || null };
  console.log(`${file}: ${(bytes.length / 1e6).toFixed(2)} MB, sha256 ${sha256}`);
}
writeFileSync(`${OUT}MANIFEST.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nWrote public/models/${REPO}/ at commit ${manifest.commit}`);

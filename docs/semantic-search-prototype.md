# Local semantic search: prototype notes

Branch `claude/fervent-tesla-1xwqz0`. Time-boxed prototype; not for main.

## What it does

Stage 05 gains a **Search by meaning** panel. Counsel clicks **Build search
index**; passages from the documents in the Stage 05 production set are
embedded in a Web Worker with `Xenova/all-MiniLM-L6-v2` (8-bit quantized) via
transformers.js. A search returns up to 10 passages, closest in meaning first,
each with its Bates number and line (or page) locator. No score is shown.
Opening a result highlights it in the viewer and raises the existing "Add this
passage as your citation" prompt; saving goes through `commitUserCitation` and
is logged as **Added citation from a search result**.

| Requirement | Where |
|---|---|
| Model files served from this repo, no remote loading | `src/workers/embedWorker.js` (`allowRemoteModels = false`, `localModelPath`, `wasmPaths`); files go in `public/models/` via `scripts/fetch-model.mjs` |
| ONNX runtime self-hosted, not the jsdelivr default | `embedWorker.js` `wasmPaths`; `vite.config.js` aliases the WebGPU build to the CPU build |
| Same passages as citation extraction | `citablePassages()` in `src/lib/citations.js` (sentence splitter plus `excludedLines`) |
| Vectors cached in IndexedDB with the matter | `embeddings` store in `src/lib/persistence.js` (DB version 2), one record per document content hash |
| Stale when the production set changes | `searchIndexKey()` in `src/lib/semanticSearch.js` fingerprints the same producible signature as the chronology |
| Cleared by Clear Matter | `clearMatter()` clears both stores; the worker is stopped first |
| Nothing outside Stage 05 uses similarity | Only `App.jsx` Stage 05 imports it; `tests/e2e/search.mjs` checks the libraries and that Stages 01–03, the checklist and stage progress are unchanged by building and searching |

## Status of the model files

**Not committed.** This environment's network policy blocks huggingface.co, so
the real weights could not be fetched. Until they are, **Build search index**
shows "Search is unavailable" (tested). To finish:

```
node scripts/fetch-model.mjs          # needs huggingface.co; verifies SHA-256 against HF's LFS hash
git add public/models && git commit
```

## Measurements

**Every figure here comes from a timing proxy, not the real model.** The proxy
is the same graph as all-MiniLM-L6-v2 (6 BERT layers, hidden size 384, 12
heads, FFN 1536, vocabulary 30,522), 8-bit quantized the same way but with
random weights, plus a WordPiece tokenizer trained on the stress corpus. Size,
speed and memory depend on that shape, not on the weight values, so they
should be close. The proxy's tokenizer may split words differently from the
real one, which changes sequence lengths and so embedding time by some margin.
The proxy's **rankings are meaningless**, so no query result below is a finding
about search quality.

Conditions: headless Chromium in a cloud container, production build served by
a plain static server (fixed Content-Length, no compression, as GitHub Pages
serves binaries), single-threaded WebAssembly (GitHub Pages cannot send the
headers that multi-threading needs). Download times exclude network latency.
Memory is the resident set of the renderer process, which holds the page and
its worker, sampled once a second.

| | Harlow sample | Stress set, 2,000 files |
|---|---|---|
| Indexed | 4 documents, 75 passages | 1,986 documents, 5,078 passages |
| First download (model + runtime) | 37.0 MB | 37.0 MB |
| Model load (download + start) | 4.0 s | 4.6 s |
| Embedding | about 1 s | 110 s (about 46 passages/s) |
| Renderer memory | 260 → 521 MB peak → 477 MB after | 4,398 → 4,742 MB peak → 4,571 MB after (+173 MB held) |
| Search response (query embed + scan + render) | 50–110 ms | 101–188 ms |
| Vectors stored | 0.1 MB | 7.8 MB (384 floats per passage) |

- **Download breakdown:** model weights 22.7 MB (the real `model_quantized.onnx`
  is about 23 MB), runtime `.wasm` 14.3 MB, tokenizer and configs 0.06 MB (the
  real `tokenizer.json` is about 0.7 MB). Expect about 38 MB with the real files.
  At 50 Mbps that is about 6 seconds.
- **Second visit:** after a reload, nothing is fetched. The model and runtime
  come from the browser's Cache Storage and the vectors from IndexedDB; the
  first search took 0.9 s (starting the model) and embedded only the query.
- **Stress-set memory context:** the 4.4 GB baseline is the existing app
  holding a 2,000-document matter, before search. Search adds about 170 MB
  once built and about 340 MB at peak.
- **Throughput:** at about 46 passages a second single-threaded, a
  10,000-document matter at this density (about 25,000 passages) would take
  about 9 minutes to index the first time. Updates re-embed only documents new
  to the set.

### Query results (requirement 7): not yet answerable

These need the real weights. The harness is ready:

```
npm run build && (serve dist at /Product-Test/)
node testdata/stress-matter/run.mjs <2,000-file set> --url <app> --search
node testdata/stress-matter/search_bench.mjs --url <app>          # Harlow
```

It reports the rank (top 10) of each target:

| Query | Target admission |
|---|---|
| material did not meet the specified thickness | We ran 22 gauge on the Level 3 supply trunks… |
| we missed the deadline to ask for more time | We blew the 21-day window on Change Order 14. |
| the superintendent told them to keep working anyway | Don't hold up the ceiling grid on 3. |
| the foreman knew the architect had refused it | Tomasz told me on the Friday before that the architect said no. |

**Finding, independent of the model:** "Don't hold up the ceiling grid on 3."
is 36 characters, and the reused splitter drops passages of 40 characters or
fewer, so search can **never** return it. The best it can do is the next
sentence in the same email ("Get me a substitution submittal on the gauge…").
The other three targets are indexed as whole passages. If short admissions
matter (and in this case the answer key calls this one of the two most damaging
emails), index short sentences joined to their neighbour, or index paragraph
windows, for search only. Doing that would mean departing from the shared
splitter.

## Drafted copy (not applied)

Every sentence below describes what the branch's code does. **[SIZE]** must be
filled in from the real model files once they are committed (the proxy measured
37.0 MB; the real tokenizer is larger, so expect about 38 MB).

### Stage 00, confidentiality banner

Current second sentence onward: "Nothing is sent to a server and no third party
sees the text, so there is no vendor to vet. …"

Insert after "…so there is no vendor to vet.":

> Search by meaning in Stage 05 uses a model this site downloads to your
> browser the first time you build a search index. It runs on this device, like
> everything else.

### Trust panel ("Where does my data actually go?")

**Where do the documents live?** (replace)
> In this browser, on this computer. They are read from the disk you selected
> them from and held in the browser's own local database, together with what is
> computed from them, including the Stage 05 search index. No copy is created
> anywhere else.

**What is transmitted?** (replace)
> The application downloads when first opened, with some components loading on
> first use. The first time you build a search index in Stage 05, the browser
> also downloads the search model from this site ([SIZE]) and keeps it in its
> cache, so later visits do not download it again unless the browser's cache is
> cleared. No document data is ever sent: no document text, file name, search
> term or result leaves this browser.

**Who are the subprocessors?** (replace)
> There are none. No analytics, no error reporting, no hosted AI service, no
> cloud storage. The search model is a file served by this site and run by your
> browser. Nothing about your matter reaches a third party.

**How is it deleted?** (replace)
> Stage 09, "Clear Matter From This Browser", erases every document, note, tag
> and result, the search index, and the audit log. The search model stays in the
> browser's cache; it contains nothing from your matter. Clearing site data in
> your browser settings erases both.

**The whole data flow** (add a second line under the existing one)
> this site → search model (on first use) → this browser tab

and replace the footnote with:
> The search model is the only thing downloaded after the application, and it
> flows in. There is no step in either sequence that sends anything from this
> machine.

### FAQ

The repository has no FAQ page; the trust panel's question grid is the nearest
thing. These entries are for wherever the team keeps its FAQ (site, deck or
sales sheet).

**Does search by meaning send my documents to an AI service?**
> No. The search model is a file this site delivers to your browser the first
> time you build a search index. Your documents are processed by that model on
> your computer, in the browser tab. No document text, file name, search term or
> result is sent anywhere.

**What is downloaded, and how often?**
> [SIZE]: the model (all-MiniLM-L6-v2, 8-bit) and the runtime that executes it,
> both from this site. The browser keeps them in its cache, so later visits do
> not download them again unless the browser's cache is cleared.

**What does it search?**
> Passages in the documents Stage 05 shows: the same passages citation
> extraction considers, so headers, signature blocks, disclaimers, quoted
> replies and export metadata are left out. Withheld documents are not
> searched.

**Does it decide what is relevant?**
> No. It orders passages for you to read. It plays no part in relevance
> screening, the readiness check, document categories or the Stage 09
> checklist, and nothing it finds becomes a citation until you save it. It can
> miss a passage that matters; it does not replace review.

**Are my searches recorded?**
> Searches are not saved or logged. Building or updating the index is logged,
> and saving a result as a citation is logged like any citation you add.

**Is the search index deleted with the matter?**
> Yes. Clear Matter erases it. The downloaded model stays in the browser's cache
> and contains nothing from your matter.

### Wording to avoid

- "Nothing is downloaded": false once the model is used.
- "Clear Matter erases everything": the model cache survives it.
- "No AI model": there is one; it runs locally.
- "Finds every relevant passage", or any recall claim.

## Anything that affects "nothing leaves your machine"

1. **The library's default runtime location is a CDN.** transformers.js sets
   `wasmPaths` to `cdn.jsdelivr.net` unless told otherwise. The worker
   overrides it, and that URL string remains in the built bundle. With the
   override in place, no request left the site in any run: the e2e test (stand-in
   model, and real library with no model files) and the Harlow and 2,000-file
   stress benchmarks (proxy model, full load of the runtime, 0 off-site
   requests). If a future upgrade
   changes how paths resolve, the claim breaks silently. Keep the
   `no request leaves` checks, and re-run them on every transformers.js upgrade.
   A `connect-src 'self'` Content-Security-Policy would not cover this: a
   dedicated worker takes its policy from its own response headers, and GitHub
   Pages cannot set headers.
2. **Two downloads of the model, fixed.** Given a progress callback,
   transformers.js fetches every model file in full just to size a progress bar,
   so the weights came down twice (59.7 MB instead of 37.0 MB). The worker no
   longer passes one.
3. **The model cache outlives Clear Matter.** The model and runtime sit in the
   browser's Cache Storage (`transformers-cache`). They hold nothing from the
   matter, but copy must not say Clear Matter erases everything.
4. **Vectors are derived from document text.** They are stored in the matter's
   local database, including vectors from the unredacted text of documents
   designated Redact. They never leave the browser, are deleted from storage
   when a document leaves the production set, and are erased by Clear Matter.
5. **Held-back documents can be indexed while the check is out of date.**
   Stage 05's set excludes documents the readiness check held back only while
   the check is current. A designation change voids the check, so a held-back
   document (for example, another client's misfiled letter) returns to Stage 05
   and would be embedded on the next index update. That is local and matches
   what the viewer already shows, but it is a confidentiality-hygiene gap. One
   option: allow building or updating only while the check is current.
6. **First use is visible network activity.** About [SIZE] comes from the
   site's host (GitHub Pages) the first time an index is built. GitHub sees the
   request for the model file, as it sees the application's own files today; it
   sees no document data.
7. **Model provenance.** The weights are a third-party file (Apache-2.0).
   `scripts/fetch-model.mjs` checks them against the SHA-256 Hugging Face
   publishes and writes `MANIFEST.json`; commit that and the licence with the
   files.
8. **The Stage 05 checklist counts a saved search result.** The "annotated"
   item counts citations counsel creates, and a search result saved through the
   prompt is one. Similarity decides nothing there, since counsel chose to save
   it, but it is worth knowing.
9. **GitHub Pages limits** are comfortable: largest file 22.7 MB (the proxy's
   weights; about 23 MB for the real ones) against GitHub's 100 MB per-file
   limit and 50 MB warning; the built site is about 18 MB plus about 24 MB of
   model files, against the 1 GB site limit. The runtime `.wasm` (14.3 MB) is
   emitted by the build from npm, not committed.

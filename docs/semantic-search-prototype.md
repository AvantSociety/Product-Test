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

**Committed** in `public/models/Xenova/all-MiniLM-L6-v2/`, fetched by
`scripts/fetch-model.mjs` at Hugging Face commit `751bff3`:

| File | Size | SHA-256 |
|---|---|---|
| `onnx/model_quantized.onnx` | 22.97 MB | `afdb6f1a…c848bdb1`, matches the hash Hugging Face publishes |
| `tokenizer.json` | 0.71 MB | `da0e7993…76172ab3` |
| `config.json`, `tokenizer_config.json` | under 1 KB each | in `MANIFEST.json` |
| `README.md` (model card, `license: apache-2.0`), `LICENSE` (Apache-2.0 text) | 13 KB | in `MANIFEST.json` |

The first version of the fetch script never checked the weights. Hugging Face
sends the published SHA-256 (`X-Linked-Etag`) on its redirect to the CDN, not
on the file, and `fetch` followed the redirect, so the check was skipped
without a word. The script now reads the header from the redirect and fails if
the weights have none. The model repository has no licence file, so the script
also saves the Apache-2.0 text, pinned by its SHA-256.

`tests/e2e/search.mjs` now loads the real model from the site, and separately
blocks the model files to check that **Build search index** says "Search is
unavailable". Neither sends a request off the site.

Installing dependencies: `@huggingface/transformers` depends on
`onnxruntime-node`, whose install script downloads extra binaries. That
download was reset by the network here, and the browser build does not use it:
`npm ci --onnxruntime-node-install=skip` works.

## Measurements

**Real model** (these replace the earlier random-weight proxy figures, which
were close). Conditions: headless Chromium in a cloud container, a production
build served by a plain static server (fixed Content-Length, no compression,
the way GitHub Pages serves binaries), single-threaded WebAssembly (GitHub
Pages cannot send the headers multi-threading needs). Download times exclude
network latency. Memory is the resident set of the renderer processes, which
hold the page and its worker, sampled once a second. The stress set was run
twice, and the table gives both runs where they differ.

| | Harlow sample | Stress set, 2,000 files |
|---|---|---|
| Indexed | 4 documents, 75 passages | 1,986 documents, 5,078 passages |
| First download (model + runtime) | 37.95 MB | 37.95 MB |
| Model load (download + start) | 3.4 s | 3.7–3.8 s |
| Embedding | about 1 s | 102–104 s (about 49 passages/s) |
| Renderer memory | 259 → 461 MB peak → 463 MB after | 4,241 → 4,575 peak → 4,338 after (run 1); 4,305 → 4,614 → 4,421 (run 2) |
| Search response (query embed + scan + render) | 60–100 ms | 83–187 ms |
| Vectors stored | 0.1 MB | 7.8 MB (384 floats per passage) |
| Requests off the site | 0 | 0 (both runs) |

- **Download breakdown:** weights 22.97 MB, runtime `.wasm` 14.26 MB, tokenizer
  and configs 0.71 MB. At 50 Mbps, about 6 seconds.
- **Second visit:** after a reload nothing is fetched. The model and runtime
  come from the browser's Cache Storage and the vectors from IndexedDB. The
  first search took 0.9 s (starting the model) and embedded only the query.
- **Stress-set memory:** the 4.2–4.3 GB baseline is the existing app holding a
  2,000-document matter before search. Search adds about 100–120 MB once built
  and about 330 MB at peak.
- **Throughput:** at about 49 passages a second, a 10,000-document matter at
  this density (about 25,000 passages) would take about 8.5 minutes to index
  the first time. Updates re-embed only documents new to the set.

### Query results (requirement 7): the model does not find the admissions

Stress set, 5,078 indexed passages. **Rank** is the target's position among
every indexed passage (the panel shows 10). **Repeats collapsed** counts
identical passage text once, which is the rank the target would have if the
panel grouped repeated boilerplate. Ranks beyond 10 come from `fullRanks()` in
`search_bench.mjs`. It reads the passage vectors the page stored and embeds the
query with the same model file under Node, and its top results matched the
panel's.

| Query | Target admission | Rank | Repeats collapsed | What ranked first |
|---|---|---|---|---|
| material did not meet the specified thickness | We ran 22 gauge on the Level 3 supply trunks… | 2,457 | 1,063 | "Lead times on that material are running long." (a routine email line, repeated in hundreds of emails) |
| we missed the deadline to ask for more time | We blew the 21-day window on Change Order 14. | 385 | 263 | "Today was the contract substantial completion date and we are not close." |
| the superintendent told them to keep working anyway | Don't hold up the ceiling grid on 3. | not indexed | not indexed | "- Rain; exterior work stopped at 1:30 PM." (daily field reports) |
| the foreman knew the architect had refused it | Tomasz told me on the Friday before that the architect said no. | 232 | 127 | "Please have your foreman walk it with me at 7:30…" (inspection-request emails) |

Harlow sample (75 passages): "we were never warned about the delay in
advance" finds "we did not receive any written notice of delay" **at rank 1**.
"why the shipment was late" puts "Our steel coil shipment from the mill was
held up…" **at rank 28 of 75**, below the supply agreement's delivery and
notice clauses.

**What this means.** The panel's top 10 missed all four planted admissions,
and collapsing repeats does not rescue them. Two things go wrong:

1. **Word overlap beats meaning.** This small general-purpose model ranks
   passages that share a word with the query ("material", "foreman",
   "architect", "stopped") above passages that mean the same thing in other
   words. The routine project records repeat such lines hundreds of times,
   so one template can fill the whole top 10.
2. **The admissions need inference.** "22 gauge instead of the specified 20"
   is a thickness failure only to someone who knows that a higher gauge is
   thinner sheet metal. "Blew the 21-day window" is a missed deadline only in
   context. The model does not make those connections.

In the one case it gets right (the Harlow notice email), the query and the
passage use nearly the same words.

**Recommendation: do not show this to a client as it stands.** An attorney who
tries "the foreman knew the architect refused it" and gets ten copies of an
inspection-request email will stop trusting the tool, including its other
stages. Options, none tried here:

- Group identical passages in the panel (cheap, and the repeated-boilerplate
  problem is real on any construction file). By itself it does not fix
  requirement 7 (best collapsed rank above: 127).
- Try a stronger small model (for example a `bge-small` or `e5-small` class
  model) with the same harness. Each costs a similar download. Nothing here
  says it would reach the top 10. `fullRanks()` would show it in one run.
- Rethink the feature. Admissions like these are what attorney review finds,
  and a local embedding model of this size does not. Keyword search may
  serve the "find me that email" need as well and is easier to explain; that
  is untested.

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

Every sentence below describes what the branch's code does. Sizes are from the
committed model files (37.95 MB measured). Given the query results above,
none of this copy should be applied unless the feature ships.

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
> also downloads the search model from this site (about 38 MB) and keeps it in its
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
> about 38 MB: the model (all-MiniLM-L6-v2, 8-bit) and the runtime that executes it,
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
   override in place, no request left the site in any run: the e2e test
   (stand-in model, the real model, and the real library with the model files
   blocked) and the Harlow and 2,000-file stress benchmarks with the real
   model (0 off-site requests). If a future upgrade changes how paths resolve, the claim breaks silently. Keep the
   `no request leaves` checks, and re-run them on every transformers.js upgrade.
   A `connect-src 'self'` Content-Security-Policy would not cover this: a
   dedicated worker takes its policy from its own response headers, and GitHub
   Pages cannot set headers.
2. **Two downloads of the model, fixed.** Given a progress callback,
   transformers.js fetches every model file in full just to size a progress bar,
   so the weights came down twice (59.7 MB instead of 37.0 MB, measured with the earlier same-size proxy). The worker no
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
6. **First use is visible network activity.** About about 38 MB comes from the
   site's host (GitHub Pages) the first time an index is built. GitHub sees the
   request for the model file, as it sees the application's own files today; it
   sees no document data.
7. **Model provenance.** The weights are a third-party file (Apache-2.0).
   `scripts/fetch-model.mjs` checks them against the SHA-256 Hugging Face
   publishes (checked: they match) and writes `MANIFEST.json`. Both are
   committed with the model card and the Apache-2.0 text.
8. **The Stage 05 checklist counts a saved search result.** The "annotated"
   item counts citations counsel creates, and a search result saved through the
   prompt is one. Similarity decides nothing there, since counsel chose to save
   it, but it is worth knowing.
9. **GitHub Pages limits** are comfortable: largest file 22.97 MB (the
   weights), against GitHub's 100 MB per-file limit and 50 MB warning; the
   built site is about 18 MB plus about 24 MB of model files, against the 1 GB
   site limit. The runtime `.wasm` (14.3 MB) is
   emitted by the build from npm, not committed.

# Stress-test matter

A realistic, fictional case file for testing how many documents Case Intelligence
can take and whether it gets each stage right. Every person, company, project
and case number is invented.

**Tallis Development Group v. Brightwater Builders** is a construction delay
dispute over a medical office building. We act for Brightwater, the general
contractor. The owner says the job finished 74 days late and that third-floor
ductwork was installed at the wrong gauge. It has withheld $185,000 in
liquidated damages. Brightwater blames the owner's Change Order 14, but it
asked for the extra time 21 days late, and it blames the ductwork on its HVAC
subcontractor, Keystone.

## What is in it

- **48 hand-written documents with planted facts** (`core_docs.py`). Each has a
  known correct answer at every stage:
  - Contracts, change orders, letters, emails, meeting minutes, test reports
    and pay applications that tell the story.
  - 4 privileged documents to withhold and 2 documents to redact (worker SSNs,
    bank details).
  - 2 privilege traps that look privileged but must be produced.
  - 2 documents from another client, misfiled.
  - 2 scanned PDFs with no text layer, an empty export, a corrupted
    Windows-1252 export and an exact duplicate.
  - Date traps: an impossible date (02/30/2025), a UK day-first date and
    email dates the tool can't read.
  - Documents that screen POSSIBLE, NO MATCH or OUT OF PERIOD.
- **Routine project records** fill the collection out to any size: daily field
  reports, RFIs, meeting minutes, pay applications, submittals, emails and
  delivery tickets.

## Use it

```
python3 generate.py --size 120      # or 250, 500, 1000, 2000 ...
node run.mjs out/120 --url http://localhost:5310/Product-Test/
python3 answer_key.py out/120 --scale out/250 out/500 out/1000 out/2000
```

- `generate.py` writes the files and `manifest.json` (the ground truth) to
  `out/<size>/`.
- `run.mjs` drives the app through all ten stages in Chromium and saves what
  the app did to `results.json`. Run it against a production build
  (`npm run build && npx vite preview --port 5310`) for honest timings.
- `answer_key.py` builds `Answer Key - <size> documents.xlsx` and marks every
  check PASS, FAIL or FINDING:
  - **FAIL:** the app got it wrong.
  - **FINDING:** the app followed its rules, but an attorney needs to know the
    result.

To test by hand instead, upload the folder and follow the "Read me" sheet of
the answer key.

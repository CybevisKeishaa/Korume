# Print PDF (Tải PDF) — operations

`POST /api/vocab/print/pdf` renders the learner's worksheet with server-side Chromium (spec
`docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md` §6).

- **Dependency:** `playwright` (production `dependencies`, same version as `@playwright/test`).
- **Install the browser on every server**, after `npm ci`: `npx playwright install --with-deps chromium`.
  Without it the route answers 503 and `In` (browser print) still works.
- **`PRINT_PDF_ORIGIN`** (optional): the origin Chromium loads the render page from. Default
  `http://127.0.0.1:$PORT` (PORT defaults to 3000). Chromium aborts every request to any other origin.
- **Single instance:** render jobs and the queue live in the Node process (one render at a time, four waiting, 30s
  timeout, 5 PDFs per learner per minute). A multi-instance deploy needs a shared job store first.
- **Memory:** one browser; it closes after 5 idle minutes.

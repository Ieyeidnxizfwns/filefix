# PDF Toolkit

A browser-based PDF utility app built with React + Vite. No AI APIs and no application backend.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Included tools

1. Merge PDF
2. Split PDF (extract selected pages)
3. Compress PDF (rasterizes pages; lossy)
4. PDF to JPG (downloads a ZIP of JPG pages)
5. JPG/PNG to PDF
6. Rotate PDF
7. Remove PDF pages
8. Organize PDF (creates a new PDF in the requested page order)
9. Unlock PDF (only re-saves PDFs that the library can already open; does not bypass passwords/DRM)
10. PDF metadata viewer

## Privacy

The app processes selected files in the browser. It does not contain an upload endpoint or application server. The Google Fonts import in `src/styles.css` is an optional external font request; remove the `@import` line if you want all network requests eliminated.

## Important limitations

- PDF compression is implemented by rendering pages to JPEG and rebuilding the PDF. This can reduce size but is lossy and removes selectable text, links, forms and vector content.
- Browser-only PDF unlocking cannot crack unknown open passwords or bypass DRM. Encrypted PDFs may not be supported by PDF-lib.
- The PDF-to-JPG tool packages the page images into a ZIP.
- Large PDFs may use substantial memory. Test with representative files and adjust the 100 MB per-file limit for your target devices.
- The PDF splitter extracts pages from the first uploaded PDF. The organizer uses a comma-separated page order and exports only the pages listed.

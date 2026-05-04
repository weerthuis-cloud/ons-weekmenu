// pdf.js wrapper voor client-side PDF-extractie.
// Geeft per pagina een lijst tekst-items met x/y/breedte. PDF blijft op het apparaat.
//
// v2.2: lazy-load van pdfjs-dist + worker. ~1MB wordt pas geladen op het
// moment dat extractPdf() voor het eerst wordt aangeroepen (Import-tab).
// Daarvoor zit pdfjs niet in de hoofdbundel.

let _pdfjsLoaded = null;
async function loadPdfjs() {
  if (_pdfjsLoaded) return _pdfjsLoaded;
  _pdfjsLoaded = (async () => {
    const pdfjsLib = await import('pdfjs-dist');
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
    return pdfjsLib;
  })();
  return _pdfjsLoaded;
}

/**
 * Extract text-items per page.
 * @param {File|ArrayBuffer} source
 * @returns {Promise<{ pages: Array<{ width, height, items: Array<{text, x, y, w, h}> }>}>}
 */
export async function extractPdf(source) {
  const pdfjsLib = await loadPdfjs();
  const data = source instanceof File ? await source.arrayBuffer() : source;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items
      .filter(it => it.str && it.str.trim())
      .map(it => {
        // it.transform = [a, b, c, d, e, f] → e=x, f=y (PDF-Y omhoog)
        // We zetten Y naar top-down (vergelijkbaar met pdfplumber 'top')
        const x = it.transform[4];
        const yPdf = it.transform[5];
        const top = viewport.height - yPdf - it.height;
        return {
          text: it.str.trim(),
          x: Math.round(x * 10) / 10,
          y: Math.round(top * 10) / 10,
          w: it.width,
          h: it.height,
        };
      });
    pages.push({ width: viewport.width, height: viewport.height, items });
  }
  return { pages };
}

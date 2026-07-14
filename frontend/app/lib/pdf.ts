/**
 * Client-side "true" PDF export (FR 10.4). Rasterizes a report element with
 * html2canvas and lays it into a real, downloadable PDF file with jsPDF —
 * no browser print dialog. Both libraries are imported dynamically so they
 * stay out of the initial bundle and only load when the user exports.
 *
 * The clone passed to html2canvas hides interactive chrome (`.no-print`) and
 * reveals the report letterhead (`.print-only`), so the PDF matches the print
 * layout rather than the on-screen one.
 */
export async function exportElementToPdf(
  el: HTMLElement | null,
  filename: string
): Promise<void> {
  if (!el) return;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2, // sharper text on the page
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: el.scrollWidth,
    onclone: (doc) => {
      doc
        .querySelectorAll<HTMLElement>(".no-print")
        .forEach((n) => (n.style.display = "none"));
      doc
        .querySelectorAll<HTMLElement>(".print-only")
        .forEach((n) => (n.style.display = "block"));
    },
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const usableH = pageH - margin * 2;

  const img = canvas.toDataURL("image/png");

  // Place the single tall image and shift it up one usable-page-height per page
  // so it prints across as many pages as it needs.
  let heightLeft = imgH;
  let position = margin;
  pdf.addImage(img, "PNG", margin, position, imgW, imgH);
  heightLeft -= usableH;

  while (heightLeft > 0) {
    position -= usableH;
    pdf.addPage();
    pdf.addImage(img, "PNG", margin, position, imgW, imgH);
    heightLeft -= usableH;
  }

  pdf.save(filename);
}

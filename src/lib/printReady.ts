/** Wait for document assets and layout before invoking the browser's PDF/print dialog. */
export async function printWhenReady(printWindow: Window): Promise<void> {
  const document = printWindow.document;
  await Promise.all(Array.from(document.images, image => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));
  if (document.fonts) await document.fonts.ready;
  if (printWindow.closed) return;
  // Two frames let inline SVG QRs and loaded images reach the print layout.
  await new Promise<void>(resolve => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())));
  if (printWindow.closed) return;
  printWindow.focus();
  printWindow.print();
}
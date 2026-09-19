import { translateDelimitedText } from '@/i18n/runtime';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string;
  width?: number;
};

const escapeCsv = (value: string) => {
  const v = value ?? '';
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const timestampSuffix = () =>
  new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/** Export any tabular data to a semicolon-separated CSV (Excel-friendly, UTF-8 BOM). */
export function exportRowsToCsv<T>(rows: T[], columns: ExportColumn<T>[], fileName: string) {
  const header = columns.map((c) => escapeCsv(c.header)).join(';');
  const body = rows.map((row) => columns.map((c) => escapeCsv(c.value(row))).join(';'));
  const csv = ['\uFEFF' + header, ...body].join('\r\n');
  triggerDownload(new Blob([translateDelimitedText(csv)], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
}

/** Export any tabular data to a paginated, branded PDF report. */
export function exportRowsToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
  options: { title: string; subtitle?: string } = { title: 'Rapport' },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(6, 148, 162);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('AQUAPILOTE', 14, 10);
  doc.setFontSize(10);
  doc.text(options.title, 14, 17);

  doc.setTextColor(90, 90, 90);
  doc.setFontSize(9);
  doc.text(
    `${options.subtitle ? options.subtitle + ' — ' : ''}${rows.length} enregistrement(s) — généré le ${new Date().toLocaleString('fr-FR')}`,
    14,
    29,
  );

  autoTable(doc, {
    startY: 34,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => c.value(row))),
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [6, 148, 162], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 250, 251] },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.width) acc[i] = { cellWidth: c.width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    margin: { left: 10, right: 10, bottom: 14 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Page ${page}`, pageWidth - 22, pageHeight - 7);
    },
  });

  doc.save(`${fileName}.pdf`);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface HealthReportInput {
  title: string;
  date: Date;
  unitName: string;
  species?: string | null;
  subject?: string | null;
  symptoms?: string[];
  observations?: string[];
  diseases: { name: string; level?: string | null; confidence?: number | null }[];
  recommendations?: string[];
}

const SEV: Record<string, string> = { low: 'Faible', medium: 'Modéré', high: 'Élevé', critical: 'Critique' };

export function buildHealthReportPdf(r: HealthReportInput): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text(r.title, 14, 18);
  doc.setFontSize(10);
  doc.text(`Date : ${r.date.toLocaleString('fr-FR')}`, 14, 26);
  doc.text(`Unité : ${r.unitName}`, 14, 31);
  let y = 36;
  if (r.species) { doc.text(`Espèce : ${r.species}`, 14, y); y += 5; }
  if (r.subject) { doc.text(`Sujet analysé : ${r.subject}`, 14, y); y += 5; }
  const list = (head: string, items?: string[]) => {
    if (!items?.length) return;
    autoTable(doc, { startY: y + 2, head: [[head]], body: items.map((i) => [i]), styles: { fontSize: 9 } });
    y = (doc as any).lastAutoTable.finalY + 2;
  };
  list('Symptômes observés', r.symptoms);
  list('Observations', r.observations);
  autoTable(doc, {
    startY: y + 2,
    head: [['Hypothèse', 'Niveau', 'Confiance']],
    body: r.diseases.length
      ? r.diseases.map((d) => [d.name, d.level ? SEV[d.level] ?? d.level : '-', d.confidence != null ? `${Math.round(d.confidence)} %` : '-'])
      : [['Aucune hypothèse retenue', '-', '-']],
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 2;
  list('Recommandations', r.recommendations);
  doc.setFontSize(8);
  doc.text(
    'Hypothèses à confirmer par un expert, consultant ou technicien en aquaculture.',
    14,
    Math.min(y + 8, 285),
  );
  return doc.output('blob');
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareOrDownloadPdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === 'AbortError') return; }
  }
  downloadPdf(blob, filename);
}

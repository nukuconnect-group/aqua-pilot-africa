import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import consultantPhotoUrl from '@/assets/consultant-komi-sena.jpg';

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
  /** Photo analysée (data URL) : affichée en haut du rapport. */
  photoDataUrl?: string | null;
}

const SEV: Record<string, string> = { low: 'Faible', medium: 'Modéré', high: 'Élevé', critical: 'Critique' };

const CONSULTANT = {
  name: 'Komi Sena',
  title: 'Consultant en aquaculture',
  detail: 'Validation technique et accompagnement piscicole',
};

interface PdfImage { dataUrl: string; width: number; height: number }

/** jsPDF n'embarque que JPEG/PNG : conversion via canvas, proportions conservées. */
const toJpegImage = (dataUrl: string) => new Promise<PdfImage | null>((resolve) => {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: img.naturalWidth, height: img.naturalHeight });
    } catch { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

let consultantCache: PdfImage | null | undefined;
const loadConsultantPhoto = async (): Promise<PdfImage | null> => {
  if (consultantCache !== undefined) return consultantCache;
  try {
    const res = await fetch(consultantPhotoUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('lecture image impossible'));
      r.readAsDataURL(blob);
    });
    consultantCache = await toJpegImage(dataUrl);
  } catch { consultantCache = null; }
  return consultantCache;
};

/** Cadre vert discret avec photo, nom et titre du consultant. */
const drawConsultantBlock = (doc: jsPDF, photo: PdfImage | null, topY: number) => {
  const blockY = Math.min(topY, 245);
  doc.setDrawColor(4, 120, 87);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, blockY, 182, 26, 2, 2);
  let textX = 20;
  if (photo) {
    const h = 20;
    const w = Math.min(20, (h * photo.width) / photo.height);
    try {
      doc.addImage(photo.dataUrl, 'JPEG', 18, blockY + 3, w, h);
      textX = 18 + w + 4;
    } catch { /* la photo est un plus : le bloc reste affiché sans elle */ }
  }
  doc.setFontSize(11);
  doc.setTextColor(4, 120, 87);
  doc.text(CONSULTANT.name, textX, blockY + 9);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(CONSULTANT.title, textX, blockY + 15);
  doc.setFontSize(8);
  doc.text(CONSULTANT.detail, textX, blockY + 20);
  doc.setTextColor(0, 0, 0);
  return blockY + 26;
};

export async function buildHealthReportPdf(r: HealthReportInput): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text(r.title, 14, 18);
  doc.setFontSize(10);
  doc.text(`Date : ${r.date.toLocaleString('fr-FR')}`, 14, 26);
  doc.text(`Unité : ${r.unitName}`, 14, 31);
  let y = 36;
  if (r.species) { doc.text(`Espèce : ${r.species}`, 14, y); y += 5; }
  if (r.subject) { doc.text(`Sujet analysé : ${r.subject}`, 14, y); y += 5; }
  if (r.photoDataUrl) {
    const photo = await toJpegImage(r.photoDataUrl);
    if (photo) {
      const maxW = 46;
      const maxH = 36;
      const scale = Math.min(maxW / photo.width, maxH / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      try {
        doc.addImage(photo.dataUrl, 'JPEG', 196 - w, 10, w, h);
        doc.setFontSize(8);
        doc.text('Photo analysée', 196 - w, 12 + h);
      } catch { /* la photo est un plus : le rapport reste généré sans elle */ }
    }
  }
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
  const consultantPhoto = await loadConsultantPhoto();
  const bottomY = drawConsultantBlock(doc, consultantPhoto, y + 8);
  doc.setFontSize(8);
  doc.text(
    'Hypothèses à confirmer par un expert, consultant ou technicien en aquaculture.',
    14,
    Math.min(bottomY + 7, 290),
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

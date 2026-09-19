import { translateHtmlDocument, translateDelimitedText } from '@/i18n/runtime';
/**
 * Utilitaires pour l'export des rapports en différents formats
 */

import { CompanyInfoForPrint, generateCompanyHeaderHTML } from './companyHeaderUtils';

/**
 * Escape HTML special characters to prevent XSS attacks
 */
const escapeHtml = (unsafe: string | number | null | undefined): string => {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export interface ReportData {
  title: string;
  period: string;
  generatedAt: string;
  unitName?: string;
  sections: ReportSection[];
  companyInfo?: CompanyInfoForPrint;
}

export interface ReportSection {
  title: string;
  type: 'table' | 'summary' | 'chart-data';
  headers?: string[];
  rows?: (string | number)[][];
  summary?: { label: string; value: string | number }[];
}

/**
 * Génère un fichier CSV à partir des données
 */
export const exportToCSV = (data: ReportData, filename: string) => {
  let csvContent = '';
  
  // En-tête entreprise
  if (data.companyInfo?.name) {
    csvContent += `"${data.companyInfo.name}"\n`;
    if (data.companyInfo.address) csvContent += `"${data.companyInfo.address}"\n`;
    if (data.companyInfo.phone || data.companyInfo.email) {
      csvContent += `"${data.companyInfo.phone || ''} ${data.companyInfo.email || ''}"\n`;
    }
    csvContent += '\n';
  }
  
  // En-tête du rapport
  csvContent += `"${data.title}"\n`;
  csvContent += `"Période: ${data.period}"\n`;
  csvContent += `"Généré le: ${data.generatedAt}"\n`;
  if (data.unitName) {
    csvContent += `"Unité: ${data.unitName}"\n`;
  }
  csvContent += '\n';

  // Sections
  data.sections.forEach(section => {
    csvContent += `"${section.title}"\n`;
    
    if (section.type === 'table' && section.headers && section.rows) {
      csvContent += section.headers.map(h => `"${h}"`).join(',') + '\n';
      section.rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
    } else if (section.type === 'summary' && section.summary) {
      section.summary.forEach(item => {
        csvContent += `"${item.label}","${item.value}"\n`;
      });
    }
    csvContent += '\n';
  });

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Génère un fichier Excel (format TSV compatible)
 */
export const exportToExcel = (data: ReportData, filename: string) => {
  let content = '';
  
  // En-tête entreprise
  if (data.companyInfo?.name) {
    content += `${data.companyInfo.name}\n`;
    if (data.companyInfo.address) content += `${data.companyInfo.address}\n`;
    if (data.companyInfo.phone || data.companyInfo.email) {
      content += `${data.companyInfo.phone || ''}\t${data.companyInfo.email || ''}\n`;
    }
    content += '\n';
  }
  
  // En-tête du rapport
  content += `${data.title}\n`;
  content += `Période: ${data.period}\n`;
  content += `Généré le: ${data.generatedAt}\n`;
  if (data.unitName) {
    content += `Unité: ${data.unitName}\n`;
  }
  content += '\n';

  // Sections
  data.sections.forEach(section => {
    content += `${section.title}\n`;
    
    if (section.type === 'table' && section.headers && section.rows) {
      content += section.headers.join('\t') + '\n';
      section.rows.forEach(row => {
        content += row.join('\t') + '\n';
      });
    } else if (section.type === 'summary' && section.summary) {
      section.summary.forEach(item => {
        content += `${item.label}\t${item.value}\n`;
      });
    }
    content += '\n';
  });

  // Export as .xls with tab separator (Excel compatible)
  downloadFile(content, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
};

/**
 * Génère un fichier Word (format HTML compatible)
 */
export const exportToWord = (data: ReportData, filename: string) => {
  // Générer l'en-tête entreprise HTML
  const companyHeader = data.companyInfo ? generateCompanyHeaderHTML(data.companyInfo) : '';
  
  let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(data.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
        h2 { color: #2c5282; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #cbd5e0; padding: 10px; text-align: left; }
        th { background-color: #e2e8f0; font-weight: bold; }
        .summary-item { margin: 8px 0; }
        .summary-label { font-weight: bold; color: #4a5568; }
        .summary-value { color: #2d3748; }
        .header-info { color: #718096; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      ${companyHeader}
      <h1>${escapeHtml(data.title)}</h1>
      <p class="header-info"><strong>Période:</strong> ${escapeHtml(data.period)}</p>
      <p class="header-info"><strong>Généré le:</strong> ${escapeHtml(data.generatedAt)}</p>
      ${data.unitName ? `<p class="header-info"><strong>Unité:</strong> ${escapeHtml(data.unitName)}</p>` : ''}
  `;

  data.sections.forEach(section => {
    htmlContent += `<h2>${escapeHtml(section.title)}</h2>`;
    
    if (section.type === 'table' && section.headers && section.rows) {
      htmlContent += '<table>';
      htmlContent += '<tr>' + section.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
      section.rows.forEach(row => {
        htmlContent += '<tr>' + row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') + '</tr>';
      });
      htmlContent += '</table>';
    } else if (section.type === 'summary' && section.summary) {
      section.summary.forEach(item => {
        htmlContent += `<div class="summary-item"><span class="summary-label">${escapeHtml(item.label)}:</span> <span class="summary-value">${escapeHtml(item.value)}</span></div>`;
      });
    }
  });

  htmlContent += '</body></html>';

  downloadFile(htmlContent, `${filename}.doc`, 'application/msword;charset=utf-8;');
};

/**
 * Génère un PDF professionnel via jsPDF + autotable
 * - Page de couverture avec logo/entreprise/période
 * - Sommaire numéroté
 * - Sections détaillées avec tables et résumés
 * - En-tête et pied de page sur chaque page (n° de page, date, nom de l'entreprise)
 * - Signature en dernière page
 */
export const exportToPDF = async (data: ReportData, filename: string) => {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Charte couleurs "cabinet"
  const brand: [number, number, number] = [30, 58, 95];       // #1e3a5f
  const accent: [number, number, number] = [49, 130, 206];    // #3182ce
  const soft: [number, number, number] = [247, 250, 252];     // #f7fafc
  const grayText: [number, number, number] = [80, 90, 105];

  const company = data.companyInfo;

  /* ---------- PAGE DE COUVERTURE ---------- */
  // Bande couleur haut
  doc.setFillColor(...brand);
  doc.rect(0, 0, pageWidth, 55, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 55, pageWidth, 3, 'F');

  // Logo
  if (company?.logoUrl) {
    try {
      // Try image only if it's a data URL or same-origin URL to avoid taint
      doc.addImage(company.logoUrl, 'PNG', margin, 10, 32, 32);
    } catch { /* ignore logo errors */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(company?.name || 'AQUAPILOTE', pageWidth - margin, 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (company?.address) doc.text(company.address.substring(0, 60), pageWidth - margin, 30, { align: 'right' });
  if (company?.phone || company?.email) {
    doc.text(`${company?.phone || ''}${company?.phone && company?.email ? ' · ' : ''}${company?.email || ''}`, pageWidth - margin, 36, { align: 'right' });
  }

  // Titre du rapport (centré)
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(data.title, pageWidth - margin * 2);
  doc.text(titleLines, pageWidth / 2, 100, { align: 'center' });

  // Ligne décorative
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 30, 115, pageWidth / 2 + 30, 115);

  // Bloc info
  doc.setFillColor(...soft);
  doc.roundedRect(margin + 20, 135, pageWidth - (margin + 20) * 2, 60, 3, 3, 'F');
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('INFORMATIONS DU RAPPORT', pageWidth / 2, 148, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...grayText);

  const info: [string, string][] = [
    ['Période', data.period],
    ['Date de génération', data.generatedAt],
  ];
  if (data.unitName) info.push(['Unité de production', data.unitName]);
  if (company?.name) info.push(['Entité', company.name]);

  info.forEach(([label, value], i) => {
    const y = 160 + i * 8;
    doc.setFont('helvetica', 'bold');
    doc.text(label + ' :', margin + 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value).substring(0, 70), margin + 75, y);
  });

  // Pied de couverture
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(
    'Document confidentiel - Généré automatiquement par AQUAPILOTE',
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' },
  );

  /* ---------- SOMMAIRE ---------- */
  doc.addPage();
  drawHeader(doc, data, brand, accent, pageWidth, margin);
  let y = 45;
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Sommaire', margin, y);
  y += 4;
  doc.setDrawColor(...accent);
  doc.line(margin, y, margin + 40, y);
  y += 10;

  doc.setTextColor(...grayText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  data.sections.forEach((section, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand);
    doc.text(`${num}.`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayText);
    doc.text(section.title, margin + 12, y);
    // ligne pointillée
    const dotsFrom = margin + 12 + doc.getTextWidth(section.title) + 3;
    const dotsTo = pageWidth - margin - 15;
    if (dotsTo > dotsFrom) {
      let x = dotsFrom;
      while (x < dotsTo) {
        doc.circle(x, y - 1, 0.2, 'F');
        x += 2;
      }
    }
    y += 9;
    if (y > pageHeight - 30) { doc.addPage(); drawHeader(doc, data, brand, accent, pageWidth, margin); y = 45; }
  });

  /* ---------- SECTIONS ---------- */
  data.sections.forEach((section, idx) => {
    doc.addPage();
    drawHeader(doc, data, brand, accent, pageWidth, margin);

    // Bandeau titre section
    doc.setFillColor(...brand);
    doc.roundedRect(margin, 40, pageWidth - margin * 2, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`${String(idx + 1).padStart(2, '0')}. ${section.title}`, margin + 4, 48);

    let cursorY = 60;

    if (section.type === 'summary' && section.summary) {
      // Grille de KPI 2 colonnes
      const cardW = (pageWidth - margin * 2 - 6) / 2;
      const cardH = 22;
      section.summary.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + col * (cardW + 6);
        const yy = cursorY + row * (cardH + 6);
        if (yy + cardH > pageHeight - 25) return; // safety
        doc.setFillColor(...soft);
        doc.roundedRect(x, yy, cardW, cardH, 2, 2, 'F');
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.3);
        doc.line(x, yy, x, yy + cardH);
        doc.setTextColor(...grayText);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(String(item.label).substring(0, 40), x + 4, yy + 8);
        doc.setTextColor(...brand);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(String(item.value).substring(0, 30), x + 4, yy + 17);
      });
    } else if (section.type === 'table' && section.headers && section.rows) {
      autoTable(doc, {
        startY: cursorY,
        head: [section.headers],
        body: section.rows.map((r) => r.map((c) => String(c ?? ''))),
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: grayText },
        headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: soft },
        margin: { left: margin, right: margin },
        didDrawPage: () => drawHeader(doc, data, brand, accent, pageWidth, margin),
      });
    }
  });

  /* ---------- SIGNATURE (dernière page) ---------- */
  doc.addPage();
  drawHeader(doc, data, brand, accent, pageWidth, margin);
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Validation et signature', margin, 55);

  doc.setTextColor(...grayText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const disclaimer =
    "Le présent rapport a été généré automatiquement à partir des données enregistrées dans AQUAPILOTE à la date indiquée. Il reflète l'état de l'exploitation sur la période sélectionnée et peut servir de pièce justificative interne, comptable ou administrative.";
  const wrapped = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(wrapped, margin, 68);

  // Cadres signature
  const boxY = 130;
  const boxW = (pageWidth - margin * 2 - 10) / 2;
  const boxH = 45;
  ['Responsable d\'exploitation', 'Direction / Comptabilité'].forEach((label, i) => {
    const x = margin + i * (boxW + 10);
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...brand);
    doc.text(label, x + 3, boxY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    doc.text('Nom :', x + 3, boxY + 20);
    doc.text('Date :', x + 3, boxY + 30);
    doc.text('Signature :', x + 3, boxY + 40);
  });

  /* ---------- NUMÉROTATION PIED DE PAGE ---------- */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayText);
    doc.text(company?.name || 'AQUAPILOTE', margin, pageHeight - 6);
    doc.text(data.generatedAt, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  doc.save(`${filename}.pdf`);
};

function drawHeader(
  doc: any,
  data: ReportData,
  brand: [number, number, number],
  accent: [number, number, number],
  pageWidth: number,
  margin: number,
) {
  doc.setFillColor(...brand);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 22, pageWidth, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(data.companyInfo?.name || 'AQUAPILOTE', margin, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.title.substring(0, 60), margin, 17);
  doc.setFontSize(8);
  doc.text(data.period, pageWidth - margin, 10, { align: 'right' });
  if (data.unitName) doc.text(data.unitName.substring(0, 30), pageWidth - margin, 17, { align: 'right' });
}

/**
 * Télécharge un fichier
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const isHtml = /msword|html/.test(mimeType) || /^\s*<(!DOCTYPE|html)/i.test(content);
  const localized = isHtml ? translateHtmlDocument(content) : translateDelimitedText(content);
  const blob = new Blob(['\ufeff' + localized], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Formate une date pour le nom de fichier
 */
export const getReportFilename = (reportType: string, unitName?: string): string => {
  const date = new Date().toISOString().split('T')[0];
  const unit = unitName ? `_${unitName.replace(/\s+/g, '-')}` : '';
  return `rapport-${reportType}${unit}_${date}`;
};

/**
 * Formate un montant en devise
 */
export const formatAmount = (amount: number, currency: string = 'XOF'): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' F CFA';
};

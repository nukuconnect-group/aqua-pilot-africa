import { translateDelimitedText, translateHtmlDocument } from '@/i18n/runtime';
// Utility for exporting control fishing records in multiple formats

interface ControlFishingRecord {
  id: string;
  date: string;
  cycle_id?: string;
  infrastructure_id?: string;
  infrastructureName?: string;
  cycleName?: string;
  temperature?: number;
  ph?: number;
  oxygen?: number;
  mortality?: number;
  average_weight?: number;
  sample_count?: number;
  density?: number;
  feeding?: number;
  notes?: string;
}

interface ExportOptions {
  records: ControlFishingRecord[];
  unitName?: string;
  cycleName?: string;
  date: string;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const generateDailyHTML = (options: ExportOptions): string => {
  const { records, unitName, cycleName, date } = options;
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fiche Pêche de Contrôle - ${formatDate(date)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 20px;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 3px solid #0369a1;
          padding-bottom: 15px;
        }
        .logo { font-size: 24px; font-weight: bold; color: #0369a1; }
        .report-title { font-size: 20px; color: #0c4a6e; margin: 15px 0 10px; }
        .report-date { font-size: 16px; color: #666; font-weight: 500; }
        .meta-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f0f9ff;
          border-radius: 8px;
        }
        .meta-item { text-align: left; }
        .meta-label { font-size: 11px; color: #666; text-transform: uppercase; }
        .meta-value { font-size: 14px; font-weight: 600; color: #0369a1; }
        .record-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }
        .record-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .record-title { font-size: 16px; font-weight: 600; color: #0369a1; }
        .record-infra { font-size: 12px; color: #666; }
        .params-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }
        .param-box {
          text-align: center;
          padding: 10px;
          background: #f8fafc;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .param-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
        .param-value { font-size: 18px; font-weight: 700; color: #0c4a6e; }
        .param-unit { font-size: 11px; color: #94a3b8; }
        .notes-section {
          margin-top: 12px;
          padding: 12px;
          background: #fefce8;
          border-radius: 6px;
          border-left: 4px solid #eab308;
        }
        .notes-title { font-size: 12px; font-weight: 600; color: #854d0e; margin-bottom: 5px; }
        .notes-content { font-size: 12px; color: #713f12; white-space: pre-wrap; }
        .summary-section {
          background: linear-gradient(135deg, #ecfdf5, #d1fae5);
          padding: 20px;
          border-radius: 10px;
          margin-top: 25px;
        }
        .summary-title { font-size: 16px; font-weight: 600; color: #065f46; margin-bottom: 15px; }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }
        .summary-item { text-align: center; }
        .summary-value { font-size: 22px; font-weight: bold; color: #047857; }
        .summary-label { font-size: 11px; color: #065f46; }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        @media print {
          body { padding: 10px; }
          .no-print { display: none; }
        }
        .print-btn {
          background: #0369a1;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          margin: 15px auto;
          display: block;
        }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer / Télécharger PDF</button>
      
      <div class="header">
        <div class="logo">🐟 AQUAPILOTE</div>
        <h1 class="report-title">Fiche de Pêche de Contrôle</h1>
        <div class="report-date">${formatDate(date)}</div>
      </div>

      <div class="meta-section">
        ${unitName ? `<div class="meta-item"><div class="meta-label">Unité de production</div><div class="meta-value">${unitName}</div></div>` : ''}
        ${cycleName ? `<div class="meta-item"><div class="meta-label">Cycle</div><div class="meta-value">${cycleName}</div></div>` : ''}
        <div class="meta-item"><div class="meta-label">Date</div><div class="meta-value">${formatDate(date)}</div></div>
        <div class="meta-item"><div class="meta-label">Nb enregistrements</div><div class="meta-value">${records.length}</div></div>
      </div>

      ${records.length === 0 ? `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>Aucune pêche de contrôle enregistrée pour cette date.</p>
        </div>
      ` : records.map((record, idx) => `
        <div class="record-card">
          <div class="record-header">
            <div>
              <div class="record-title">Pêche #${idx + 1}</div>
              ${record.infrastructureName ? `<div class="record-infra">Infrastructure: ${record.infrastructureName}</div>` : ''}
              ${record.cycleName ? `<div class="record-infra">Cycle: ${record.cycleName}</div>` : ''}
            </div>
          </div>
          <div class="params-grid">
            <div class="param-box">
              <div class="param-label">Température</div>
              <div class="param-value">${record.temperature ?? '-'}</div>
              <div class="param-unit">°C</div>
            </div>
            <div class="param-box">
              <div class="param-label">pH</div>
              <div class="param-value">${record.ph ?? '-'}</div>
              <div class="param-unit"></div>
            </div>
            <div class="param-box">
              <div class="param-label">Oxygène</div>
              <div class="param-value">${record.oxygen ?? '-'}</div>
              <div class="param-unit">mg/L</div>
            </div>
            <div class="param-box">
              <div class="param-label">Mortalité</div>
              <div class="param-value">${record.mortality ?? '-'}</div>
              <div class="param-unit">ind.</div>
            </div>
            <div class="param-box">
              <div class="param-label">PMI</div>
              <div class="param-value">${record.average_weight?.toFixed(1) ?? '-'}</div>
              <div class="param-unit">g</div>
            </div>
            <div class="param-box">
              <div class="param-label">Échantillon</div>
              <div class="param-value">${record.sample_count ?? '-'}</div>
              <div class="param-unit">ind.</div>
            </div>
            <div class="param-box">
              <div class="param-label">% Prélevé</div>
              <div class="param-value">${record.density?.toFixed(1) ?? '-'}</div>
              <div class="param-unit">%</div>
            </div>
            <div class="param-box">
              <div class="param-label">Poids total</div>
              <div class="param-value">${record.feeding?.toFixed(2) ?? '-'}</div>
              <div class="param-unit">kg</div>
            </div>
          </div>
          ${record.notes ? `
            <div class="notes-section">
              <div class="notes-title">📝 Observations</div>
              <div class="notes-content">${record.notes}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}

      ${records.length > 0 ? `
        <div class="summary-section">
          <div class="summary-title">📊 Résumé du jour</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">${records.length}</div>
              <div class="summary-label">Pêches réalisées</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${records.reduce((sum, r) => sum + (r.sample_count || 0), 0)}</div>
              <div class="summary-label">Total échantillons</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${
                records.filter(r => r.average_weight).length > 0 
                  ? (records.reduce((sum, r) => sum + (r.average_weight || 0), 0) / records.filter(r => r.average_weight).length).toFixed(1)
                  : '-'
              }g</div>
              <div class="summary-label">PMI moyen</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${records.reduce((sum, r) => sum + (r.mortality || 0), 0)}</div>
              <div class="summary-label">Mortalité totale</div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="footer">
        <p>Fiche générée par AQUAPILOTE - ${new Date().toLocaleString('fr-FR')}</p>
        <p>© ${new Date().getFullYear()} AQUAPILOTE - Tous droits réservés</p>
      </div>
    </body>
    </html>
  `;
};

export const exportControlFishingToPDF = (options: ExportOptions) => {
  const html = generateDailyHTML(options);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les popups pour imprimer');
    return;
  }
  printWindow.document.write(translateHtmlDocument(html));
  printWindow.document.close();
};

export const exportControlFishingToWord = (options: ExportOptions) => {
  const html = generateDailyHTML(options);
  const blob = new Blob(['\ufeff', translateHtmlDocument(html)], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peche_controle_${options.date}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportControlFishingToExcel = (options: ExportOptions) => {
  const { records, unitName, cycleName, date } = options;
  
  const headers = [
    'Date', 'Infrastructure', 'Cycle', 'Température (°C)', 'pH', 
    'Oxygène (mg/L)', 'Mortalité', 'PMI (g)', 'Échantillon', 
    '% Prélevé', 'Poids Total (kg)', 'Observations'
  ];
  
  const rows = records.map(r => [
    formatDate(r.date),
    r.infrastructureName || '-',
    r.cycleName || cycleName || '-',
    r.temperature ?? '-',
    r.ph ?? '-',
    r.oxygen ?? '-',
    r.mortality ?? '-',
    r.average_weight?.toFixed(1) ?? '-',
    r.sample_count ?? '-',
    r.density?.toFixed(1) ?? '-',
    r.feeding?.toFixed(2) ?? '-',
    (r.notes || '').replace(/\n/g, ' ')
  ]);
  
  const content = [
    [`Fiche Pêche de Contrôle - ${formatDate(date)}`],
    [`Unité: ${unitName || '-'}`],
    [`Cycle: ${cycleName || '-'}`],
    [''],
    headers,
    ...rows
  ].map(row => row.join('\t')).join('\n');
  
  const blob = new Blob(['\ufeff' + translateDelimitedText(content)], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peche_controle_${date}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportControlFishingToCSV = (options: ExportOptions) => {
  const { records, unitName, cycleName, date } = options;
  
  const headers = [
    'Date', 'Infrastructure', 'Cycle', 'Température (°C)', 'pH', 
    'Oxygène (mg/L)', 'Mortalité', 'PMI (g)', 'Échantillon', 
    '% Prélevé', 'Poids Total (kg)', 'Observations'
  ];
  
  const rows = records.map(r => [
    formatDate(r.date),
    r.infrastructureName || '-',
    r.cycleName || cycleName || '-',
    r.temperature ?? '-',
    r.ph ?? '-',
    r.oxygen ?? '-',
    r.mortality ?? '-',
    r.average_weight?.toFixed(1) ?? '-',
    r.sample_count ?? '-',
    r.density?.toFixed(1) ?? '-',
    r.feeding?.toFixed(2) ?? '-',
    `"${(r.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  ]);
  
  const content = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  const blob = new Blob(['\ufeff' + translateDelimitedText(content)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peche_controle_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const printControlFishing = (options: ExportOptions) => {
  exportControlFishingToPDF(options);
};

import { translateDelimitedText, translateHtmlDocument } from '@/i18n/runtime';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { infrastructureQrHTML, infrastructureQrValue, infrastructureQrPng, infrastructureQrTableHTML, type InfrastructureQrIdentity } from '@/lib/infrastructureQr';

interface FeedingRecordForExport {
  id: string;
  date: string;
  time?: string;
  feed_type?: string;
  quantity: number;
  temperature?: number;
  behavior?: string;
  notes?: string;
  feederName?: string;
  prescribedQuantity?: number;
  actualQuantity?: number;
  mortality?: number;
  feedingSession?: string;
  frequency?: number;
}

interface ExportFeedingOptions {
  infrastructureQr?: InfrastructureQrIdentity;
  qrImageSrc?: string;
  record: FeedingRecordForExport;
  unitName: string;
  cycleName?: string;
  companyName?: string;
}

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
};

const parseNotesForDetails = (notes: string = '') => {
  const details: Record<string, string> = {};
  const lines = notes.split('\n');
  
  lines.forEach(line => {
    if (line.startsWith('Nourri par:')) {
      details.feederName = line.replace('Nourri par:', '').trim();
    } else if (line.startsWith('Quantité prescrite:')) {
      details.prescribedQuantity = line.replace('Quantité prescrite:', '').trim();
    } else if (line.startsWith('Quantité servie:')) {
      details.actualQuantity = line.replace('Quantité servie:', '').trim();
    } else if (line.startsWith('Quantité restante:')) {
      details.remainingQuantity = line.replace('Quantité restante:', '').trim();
    } else if (line.startsWith('Mortalité:')) {
      details.mortality = line.replace('Mortalité:', '').trim();
    } else if (line.startsWith('Session:')) {
      details.session = line.replace('Session:', '').trim();
    } else if (line.startsWith('Fréquence:')) {
      details.frequency = line.replace('Fréquence:', '').trim();
    }
  });
  
  return details;
};

export const generateDetailedFeedingHTML = (options: ExportFeedingOptions): string => {
  const { record, unitName, cycleName, companyName = 'AquaPilot' } = options;
  const details = parseNotesForDetails(record.notes || '');
  
  const cleanNotes = (record.notes || '')
    .split('\n')
    .filter(line => 
      !line.startsWith('Nourri par:') && 
      !line.startsWith('Quantité prescrite:') && 
      !line.startsWith('Quantité servie:') &&
      !line.startsWith('Quantité restante:') &&
      !line.startsWith('Mortalité:') &&
      !line.startsWith('Session:') &&
      !line.startsWith('Fréquence:')
    )
    .join('\n')
    .trim();

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Fiche de Nourrissage - ${formatDate(record.date)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 40px; 
          background: #f8fafc;
          color: #1e293b;
        }
        .container { 
          max-width: 800px; 
          margin: 0 auto; 
          background: white; 
          padding: 40px; 
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          border-bottom: 3px solid #f97316;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo { 
          font-size: 28px; 
          font-weight: 700; 
          color: #f97316;
        }
        .document-title {
          text-align: right;
        }
        .document-title h1 { 
          font-size: 24px; 
          color: #1e293b;
          margin-bottom: 5px;
        }
        .document-title p {
          color: #64748b;
          font-size: 14px;
        }
        .info-section {
          margin-bottom: 25px;
        }
        .info-section h3 {
          font-size: 16px;
          color: #f97316;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .info-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 3px solid #f97316;
        }
        .info-label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        .full-width { grid-column: span 2; }
        .notes-section {
          background: #fffbeb;
          padding: 15px;
          border-radius: 8px;
          border-left: 3px solid #f59e0b;
        }
        .notes-section h4 {
          color: #b45309;
          margin-bottom: 8px;
        }
        .notes-section p {
          color: #78350f;
          white-space: pre-line;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          color: #94a3b8;
          font-size: 12px;
        }
        .signature-block {
          margin-top: 30px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }
        .signature-area {
          text-align: center;
          padding-top: 60px;
          border-top: 1px dashed #94a3b8;
        }
        .signature-label {
          font-size: 12px;
          color: #64748b;
        }
        @media print {
          body { padding: 20px; background: white; }
          .container { box-shadow: none; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${companyName}</div>
          <div class="document-title">
            <h1>Fiche de Nourrissage</h1>
            <p>${unitName}${cycleName ? ` - ${cycleName}` : ''}</p>
          </div>
        </div>

        <div class="info-section">
          <h3>📅 Informations Générales</h3>
          ${infrastructureQrHTML(options.infrastructureQr, options.qrImageSrc)}
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${formatDate(record.date)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Heure de Nourrissage</div>
              <div class="info-value">${record.time || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Session</div>
              <div class="info-value">${details.session || record.feedingSession || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Fréquence de Nourrissage</div>
              <div class="info-value">${details.frequency || (record.frequency ? `${record.frequency} fois/jour` : '-')}</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3>🍽️ Détails du Nourrissage</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Type d'Aliment</div>
              <div class="info-value">${record.feed_type || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Quantité Prescrite</div>
              <div class="info-value">${details.prescribedQuantity || (record.prescribedQuantity ? `${record.prescribedQuantity} kg` : '-')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Quantité Servie</div>
              <div class="info-value">${details.actualQuantity || (record.actualQuantity ? `${record.actualQuantity} kg` : `${record.quantity} kg`)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Quantité Restante</div>
              <div class="info-value">${details.remainingQuantity || '-'}</div>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h3>📊 Paramètres & Observations</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Température de l'Eau</div>
              <div class="info-value">${record.temperature ? `${record.temperature}°C` : '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Comportement des Poissons</div>
              <div class="info-value">${record.behavior || '-'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Mortalité Observée</div>
              <div class="info-value">${details.mortality || (record.mortality !== undefined ? record.mortality : '-')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Personne Responsable</div>
              <div class="info-value">${details.feederName || record.feederName || '-'}</div>
            </div>
          </div>
        </div>

        ${cleanNotes ? `
        <div class="info-section">
          <div class="notes-section">
            <h4>📝 Notes & Observations</h4>
            <p>${cleanNotes}</p>
          </div>
        </div>
        ` : ''}

        <div class="signature-block">
          <div class="signature-area">
            <div class="signature-label">Signature du Responsable</div>
          </div>
          <div class="signature-area">
            <div class="signature-label">Visa du Superviseur</div>
          </div>
        </div>

        <div class="footer">
          <span>Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
          <span>${companyName} - Gestion Aquacole</span>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const exportFeedingToPDF = (options: ExportFeedingOptions) => {
  const html = generateDetailedFeedingHTML(options);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(translateHtmlDocument(html));
    printWindow.document.close();
    printWindow.print();
  }
};

export const exportFeedingToWord = async (options: ExportFeedingOptions) => {
  const html = generateDetailedFeedingHTML({ ...options, qrImageSrc: options.infrastructureQr ? await infrastructureQrPng(options.infrastructureQr) : undefined });
  const blob = new Blob([`
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
        </w:WordDocument>
      </xml>
      <![endif]-->
    </head>
    <body>
      ${html}
    </body>
    </html>
  `], { type: 'application/msword' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fiche-nourrissage-${options.record.date}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportFeedingToExcel = async (options: ExportFeedingOptions) => {
  const { record, unitName, cycleName } = options;
  const details = parseNotesForDetails(record.notes || '');
  
  const rows = [
    ['FICHE DE NOURRISSAGE'],
    [''],
    ['Unité', unitName],
    ['Cycle', cycleName || '-'],
    ['Infrastructure', options.infrastructureQr?.name || '-'],
    ['QR infrastructure', options.infrastructureQr ? infrastructureQrValue(options.infrastructureQr) : ''],
    [''],
    ['INFORMATIONS GÉNÉRALES'],
    ['Date', formatDate(record.date)],
    ['Heure', record.time || '-'],
    ['Session', details.session || record.feedingSession || '-'],
    ['Fréquence', details.frequency || '-'],
    [''],
    ['DÉTAILS DU NOURRISSAGE'],
    ['Type d\'aliment', record.feed_type || '-'],
    ['Quantité prescrite', details.prescribedQuantity || '-'],
    ['Quantité servie', `${record.quantity} kg`],
    ['Quantité restante', details.remainingQuantity || '-'],
    [''],
    ['PARAMÈTRES'],
    ['Température', record.temperature ? `${record.temperature}°C` : '-'],
    ['Comportement', record.behavior || '-'],
    ['Mortalité', details.mortality || '-'],
    ['Responsable', details.feederName || '-'],
    [''],
    ['NOTES'],
    [record.notes || '-']
  ];
  
  const figure = options.infrastructureQr ? infrastructureQrHTML(options.infrastructureQr, await infrastructureQrPng(options.infrastructureQr)) : '';
  const blob = new Blob(['\ufeff' + translateHtmlDocument(infrastructureQrTableHTML(rows, figure))], { type: 'application/vnd.ms-excel;charset=utf-8' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fiche-nourrissage-${options.record.date}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportFeedingToCSV = (options: ExportFeedingOptions) => {
  const { record, unitName, cycleName } = options;
  const details = parseNotesForDetails(record.notes || '');
  
  const headers = ['Date', 'Heure', 'Unité', 'Cycle', 'Type Aliment', 'Qté Prescrite', 'Qté Servie', 'Température', 'Comportement', 'Mortalité', 'Responsable', 'Session', 'Notes', 'Infrastructure', 'QR infrastructure'];
  const values = [
    record.date,
    record.time || '',
    unitName,
    cycleName || '',
    record.feed_type || '',
    details.prescribedQuantity || '',
    record.quantity,
    record.temperature || '',
    record.behavior || '',
    details.mortality || '',
    details.feederName || '',
    details.session || '',
    (record.notes || '').replace(/\n/g, ' '),
    options.infrastructureQr?.name || '',
    options.infrastructureQr ? infrastructureQrValue(options.infrastructureQr) : ''
  ];
  
  const csvContent = [headers.join(','), values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')].join('\n');
  const blob = new Blob(['\ufeff' + translateDelimitedText(csvContent)], { type: 'text/csv;charset=utf-8' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fiche-nourrissage-${options.record.date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

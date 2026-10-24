import { translateHtmlDocument } from '@/i18n/runtime';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { infrastructureQrHTML, type InfrastructureQrIdentity } from '@/lib/infrastructureQr';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const generateFeedingRecordHTML = (record: any, unitName: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Fiche d'Alimentation - ${unitName}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #f97316;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #f97316;
          margin: 0;
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 8px;
        }
        .section h2 {
          color: #f97316;
          margin-top: 0;
          font-size: 18px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-label {
          font-weight: bold;
          color: #666;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          color: #888;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Fiche d'Alimentation</h1>
        <p>Unité: ${unitName}</p>
        <p>Date: ${format(new Date(record.date), 'dd MMMM yyyy', { locale: fr })}</p>
      </div>
      
      <div class="section">
        <h2>Informations générales</h2>
        ${infrastructureQrHTML(record.infrastructureQr)}
        <div class="info-row">
          <span class="info-label">Date et heure:</span>
          <span>${record.date} à ${record.time || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Type d'aliment:</span>
          <span>${record.feed_type || 'N/A'}</span>
        </div>
        ${record.infrastructure_name ? `
        <div class="info-row">
          <span class="info-label">Infrastructure:</span>
          <span>${record.infrastructure_name}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="section">
        <h2>Quantités</h2>
        <div class="info-row">
          <span class="info-label">Quantité servie:</span>
          <span>${record.quantity} kg</span>
        </div>
        ${record.temperature ? `
        <div class="info-row">
          <span class="info-label">Température de l'eau:</span>
          <span>${record.temperature}°C</span>
        </div>
        ` : ''}
      </div>
      
      ${record.behavior ? `
      <div class="section">
        <h2>Observations</h2>
        <div class="info-row">
          <span class="info-label">Comportement:</span>
          <span>${record.behavior}</span>
        </div>
      </div>
      ` : ''}
      
      ${record.notes ? `
      <div class="section">
        <h2>Notes</h2>
        <p>${record.notes}</p>
      </div>
      ` : ''}
      
      <div class="footer">
        <p>Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
        <p>AquaPilote - Système de gestion aquacole</p>
      </div>
    </body>
    </html>
  `;
};

export const generateFeedingPlanHTML = (plans: any[], unitName: string) => {
  const activePlans = plans.filter(p => p.is_active);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Planning d'Alimentation - ${unitName}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #f97316;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #f97316;
          margin: 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th {
          background: #f97316;
          color: white;
          padding: 12px;
          text-align: left;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #e0e0e0;
        }
        tr:hover {
          background: #f9f9f9;
        }
        .days {
          font-size: 12px;
          color: #666;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          color: #888;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Planning d'Alimentation</h1>
        <p>Unité: ${unitName}</p>
        <p>${activePlans.length} planification(s) active(s)</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Heure</th>
            <th>Type d'aliment</th>
            <th>QR infrastructure</th>
            <th>Quantité</th>
            <th>Jours</th>
          </tr>
        </thead>
        <tbody>
          ${activePlans.map(plan => `
            <tr>
              <td><strong>${plan.time}</strong></td>
              <td>${plan.feed_type}</td>
              <td>${infrastructureQrHTML(plan.infrastructureQr)}</td>
              <td>${plan.quantity} ${plan.unit}</td>
              <td class="days">${plan.days.join(', ')}</td>
            </tr>
            ${plan.notes ? `
            <tr>
              <td colspan="5" style="padding-left: 30px; font-size: 12px; color: #666;">
                Note: ${plan.notes}
              </td>
            </tr>
            ` : ''}
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
        <p>AquaPilote - Système de gestion aquacole</p>
      </div>
    </body>
    </html>
  `;
};

export const generateFeedingSheetHTML = (
  rows: Array<{
    time: string;
    infrastructureName?: string;
    infrastructureQr?: InfrastructureQrIdentity;
    feedType: string;
    quantity: number;
    unit: string;
    days: string[];
    notes?: string;
  }>,
  unitName: string,
  title: string,
) => {
  const totalQuantity = rows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(title)} - ${escapeHtml(unitName)}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 1080px; margin: 32px auto; padding: 20px; color: #1f2937; }
        .header { display: flex; justify-content: space-between; align-items: end; gap: 20px; border-bottom: 3px solid #f97316; padding-bottom: 18px; margin-bottom: 24px; }
        .header h1 { margin: 0 0 6px; color: #c2410c; }
        .header p { margin: 2px 0; color: #6b7280; }
        .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
        .meta-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; }
        .meta-label { font-size: 11px; text-transform: uppercase; color: #9a3412; margin-bottom: 4px; }
        .meta-value { font-size: 18px; font-weight: 700; color: #7c2d12; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #ea580c; color: white; padding: 12px 10px; text-align: left; font-size: 12px; }
        td { border-bottom: 1px solid #e5e7eb; padding: 10px; vertical-align: top; font-size: 13px; }
        tr:nth-child(even) td { background: #fffaf5; }
        .pill { display: inline-block; background: #f3f4f6; border-radius: 999px; padding: 3px 8px; font-size: 11px; margin: 2px 4px 0 0; }
        .notes { color: #6b7280; font-size: 12px; }
        .footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>Unité: ${escapeHtml(unitName)}</p>
          <p>Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
        </div>
        <div>
          <p><strong>AquaPilote</strong></p>
          <p>Fiche opérationnelle de nourrissage</p>
        </div>
      </div>

      <div class="meta">
        <div class="meta-card">
          <div class="meta-label">Lignes planifiées</div>
          <div class="meta-value">${rows.length}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Quantité totale</div>
          <div class="meta-value">${totalQuantity.toLocaleString('fr-FR')} kg</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Couverture</div>
          <div class="meta-value">${rows.some((row) => row.days.length > 0) ? 'Hebdo' : 'Ponctuelle'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Heure</th>
            <th>Infrastructure</th>
            <th>Aliment</th>
            <th>Quantité</th>
            <th>Jours</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHtml(row.time || '-')}</strong></td>
              <td>${escapeHtml(row.infrastructureName || 'Toutes')}${infrastructureQrHTML(row.infrastructureQr)}</td>
              <td>${escapeHtml(row.feedType || '-')}</td>
              <td><strong>${row.quantity || 0}</strong> ${escapeHtml(row.unit || 'kg')}</td>
              <td>${row.days.map((day) => `<span class="pill">${escapeHtml(day)}</span>`).join('')}</td>
              <td class="notes">${escapeHtml(row.notes || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Document prêt pour impression ou archivage.</p>
        <p>AquaPilote - Système de gestion aquacole</p>
      </div>
    </body>
    </html>
  `;
};

export const printHTML = (html: string) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(translateHtmlDocument(html));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

export const downloadHTML = (html: string, filename: string) => {
  const blob = new Blob([translateHtmlDocument(html)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

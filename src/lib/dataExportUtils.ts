/**
 * Utilitaires pour l'export de données en différents formats.
 * Les libellés suivent la langue sélectionnée dans l'application.
 */
import { tr, runtimeLocale } from '@/i18n/runtime';
import { formatMoney, getCurrency, type CurrencyCode } from '@/lib/currency';

const L = () => runtimeLocale();
const now = () => `${new Date().toLocaleDateString(L())} ${tr('à')} ${new Date().toLocaleTimeString(L())}`;

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

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: any[];
  companyName?: string;
  unitName?: string;
}

// Generate CSV content
export const exportToCSV = (options: ExportOptions) => {
  const { columns, data } = options;
  const title = tr(options.title);
  const subtitle = options.subtitle ? tr(options.subtitle) : undefined;
  const unitName = options.unitName;
  
  let csvContent = '';
  csvContent += `"${title}"\n`;
  if (subtitle) csvContent += `"${subtitle}"\n`;
  if (unitName) csvContent += `"${tr('Unité')}: ${unitName}"\n`;
  csvContent += `"${tr('Généré le')}: ${now()}"\n`;
  csvContent += '\n';

  // Headers
  csvContent += columns.map(col => `"${tr(col.label)}"`).join(',') + '\n';
  
  // Data rows
  data.forEach(row => {
    csvContent += columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key];
      return `"${typeof value === 'string' ? tr(value) : value ?? ''}"`;
    }).join(',') + '\n';
  });

  downloadFile(csvContent, `${options.filename}.csv`, 'text/csv;charset=utf-8;');
};

// Generate Excel (TSV) content
export const exportToExcel = (options: ExportOptions) => {
  const { columns, data } = options;
  const title = tr(options.title);
  const subtitle = options.subtitle ? tr(options.subtitle) : undefined;
  const unitName = options.unitName;
  
  let content = '';
  content += `${title}\n`;
  if (subtitle) content += `${subtitle}\n`;
  if (unitName) content += `${tr('Unité')}: ${unitName}\n`;
  content += `${tr('Généré le')}: ${now()}\n`;
  content += '\n';

  // Headers
  content += columns.map(col => tr(col.label)).join('\t') + '\n';
  
  // Data rows
  data.forEach(row => {
    content += columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key];
      return (typeof value === 'string' ? tr(value) : value) ?? '';
    }).join('\t') + '\n';
  });

  downloadFile(content, `${options.filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
};

// Generate Word (HTML) document
export const exportToWord = (options: ExportOptions) => {
  const { columns, data, companyName } = options;
  const title = tr(options.title);
  const subtitle = options.subtitle ? tr(options.subtitle) : undefined;
  const unitName = options.unitName;
  
  let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
        h2 { color: #2c5282; margin-top: 10px; font-size: 14px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #cbd5e0; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #e2e8f0; font-weight: bold; }
        .header-info { color: #718096; margin-bottom: 5px; font-size: 12px; }
        .company { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<h2>${escapeHtml(subtitle)}</h2>` : ''}
      ${unitName ? `<p class="header-info"><strong>${escapeHtml(tr('Unité'))}:</strong> ${escapeHtml(unitName)}</p>` : ''}
      <p class="header-info"><strong>${escapeHtml(tr('Généré le'))}:</strong> ${escapeHtml(now())}</p>
      
      <table>
        <tr>${columns.map(col => `<th>${escapeHtml(tr(col.label))}</th>`).join('')}</tr>
        ${data.map(row => `
          <tr>${columns.map(col => {
            const value = col.format ? col.format(row[col.key], row) : row[col.key];
            return `<td>${escapeHtml(typeof value === 'string' ? tr(value) : value)}</td>`;
          }).join('')}</tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;

  downloadFile(htmlContent, `${options.filename}.doc`, 'application/msword;charset=utf-8;');
};

// Generate PDF via print
export const exportToPDF = (options: ExportOptions) => {
  const { columns, data, companyName } = options;
  const title = tr(options.title);
  const subtitle = options.subtitle ? tr(options.subtitle) : undefined;
  const unitName = options.unitName;
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(tr('Veuillez autoriser les popups pour générer le PDF'));
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        @media print { body { margin: 0; padding: 15px; } }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        h1 { color: #1e3a5f; border-bottom: 2px solid #3182ce; padding-bottom: 10px; margin-bottom: 15px; font-size: 18px; }
        h2 { color: #2c5282; font-size: 14px; margin-top: 10px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 11px; }
        th, td { border: 1px solid #cbd5e0; padding: 6px 8px; text-align: left; }
        th { background-color: #3182ce; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f7fafc; }
        .header-info { color: #718096; margin-bottom: 5px; font-size: 11px; }
        .company { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #1e3a5f; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ''}
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<h2>${escapeHtml(subtitle)}</h2>` : ''}
      ${unitName ? `<p class="header-info"><strong>${escapeHtml(tr('Unité'))}:</strong> ${escapeHtml(unitName)}</p>` : ''}
      <p class="header-info"><strong>${escapeHtml(tr('Généré le'))}:</strong> ${escapeHtml(now())}</p>
      
      <table>
        <tr>${columns.map(col => `<th>${escapeHtml(tr(col.label))}</th>`).join('')}</tr>
        ${data.map(row => `
          <tr>${columns.map(col => {
            const value = col.format ? col.format(row[col.key], row) : row[col.key];
            return `<td>${escapeHtml(typeof value === 'string' ? tr(value) : value)}</td>`;
          }).join('')}</tr>
        `).join('')}
      </table>
      
      <div class="footer">
        <p>${escapeHtml(tr('Document généré automatiquement par AquaPilote'))}</p>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// Download helper
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob(['\ufeff' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format date for display
export const formatDate = (date: string): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(L());
};

// Format currency
export const formatCurrency = (amount: number, currency?: string): string => {
  if (!amount && amount !== 0) return '-';
  return formatMoney(amount, (currency as CurrencyCode) || getCurrency());
};

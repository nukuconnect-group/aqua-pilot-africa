import React, { useCallback, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Printer, FileText, CheckCircle } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface ReceiptItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  id?: string;
  type: 'receipt' | 'quote' | 'invoice' | 'proforma';
  number: string;
  date: string;
  dueDate?: string;
  clientName: string;
  clientContact?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax?: number;
  taxRate?: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
  companyLogo?: string;
  isPaid?: boolean;
}

interface ReceiptPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  initialAction?: 'download' | 'print' | null;
  onInitialActionComplete?: () => void;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  open,
  onOpenChange,
  data,
  onConfirm,
  showConfirmButton = false,
  confirmDisabled = false,
  confirmLabel = 'Confirmer et enregistrer',
  initialAction = null,
  onInitialActionComplete,
}) => {
  const { formatCurrency, companyInfo } = useSettings();
  const { toast } = useToast();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Always show the seller (current logged-in user / company) coordinates as a fallback
  // so factures/reçus include vendor info even if companyInfo isn't fully filled in.
  const fallbackName = user?.name || 'AquaPilote';
  const fallbackEmail = user?.email || '';
  const displayCompanyName = data.companyName || companyInfo.name || fallbackName;
  const displayCompanyAddress = data.companyAddress || companyInfo.address || '';
  const builtContact = companyInfo.phone
    ? `Tél: ${companyInfo.phone}${companyInfo.email ? ` | Email: ${companyInfo.email}` : ''}`
    : companyInfo.email;
  const displayCompanyContact = data.companyContact || builtContact || (fallbackEmail ? `Email: ${fallbackEmail}` : '');
  const displayCompanyLogo = data.companyLogo || companyInfo.logoUrl || undefined;
  const displayStamp = companyInfo.hideStampOnDocuments ? undefined : companyInfo.stampUrl;
  // Signature only used for receipts (proof of payment).
  const displaySignature = data.type === 'receipt' ? companyInfo.signatureUrl : undefined;
  // PAYÉ stamp is only meaningful on receipts.
  const showPaidStamp = data.type === 'receipt' && !!data.isPaid;

  const getDocumentTitle = () => {
    switch (data.type) {
      case 'quote': return 'DEVIS';
      case 'invoice': return 'FACTURE';
      case 'proforma': return 'FACTURE PROFORMA';
      case 'receipt': return 'REÇU DE VENTE';
      default: return 'DOCUMENT';
    }
  };

  const generatePDF = useCallback(async (action: 'download' | 'print') => {
    const element = receiptRef.current;
    if (!element) return;

    try {
      toast({ title: "Génération en cours...", description: "Veuillez patienter" });

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: Math.max(window.devicePixelRatio || 1, 2),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (documentClone) => {
          const clonedElement = documentClone.querySelector('[data-receipt-root="true"]') as HTMLElement | null;
          if (clonedElement) {
            clonedElement.style.background = '#ffffff';
            clonedElement.style.color = '#111827';
            clonedElement.style.opacity = '1';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pageMargin = 8;
      const printableWidth = pdfWidth - pageMargin * 2;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scaledHeight = (imgHeight * printableWidth) / imgWidth;
      let remainingHeight = scaledHeight;
      let offsetY = pageMargin;

      pdf.addImage(imgData, 'PNG', pageMargin, offsetY, printableWidth, scaledHeight);
      remainingHeight -= pdfHeight - pageMargin * 2;

      while (remainingHeight > 0) {
        pdf.addPage();
        offsetY = pageMargin - (scaledHeight - remainingHeight);
        pdf.addImage(imgData, 'PNG', pageMargin, offsetY, printableWidth, scaledHeight);
        remainingHeight -= pdfHeight - pageMargin * 2;
      }

      const filename = `${getDocumentTitle().replace(/\s+/g, '_')}_${data.number}.pdf`;

      if (action === 'download') {
        pdf.save(filename);
        toast({ title: "PDF téléchargé", description: filename });
      } else {
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        if (printWindow) {
          printWindow.onload = () => printWindow.print();
        }
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
    }
  }, [data, toast]);

  useEffect(() => {
    if (!open || !initialAction) return;

    void generatePDF(initialAction).finally(() => {
      onInitialActionComplete?.();
    });
  }, [generatePDF, initialAction, onInitialActionComplete, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Prévisualisation du {getDocumentTitle()}
          </DialogTitle>
        </DialogHeader>

        {/* Printable receipt content */}
        <div
          ref={receiptRef}
          data-receipt-root="true"
          className="relative overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-8"
        >
          {/* PAID stamp (receipts only) */}
          {showPaidStamp && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] opacity-25">
              <div className="rounded-xl border-[6px] border-destructive px-8 py-4">
                <span className="text-[4.5rem] font-extrabold tracking-[0.4em] text-destructive sm:text-[6.5rem]">PAYÉ</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="relative z-10 mb-6 border-b-[3px] border-primary pb-4 text-center">
            {displayCompanyLogo && (
              <div className="flex justify-center mb-3">
                <div className="flex items-center justify-center rounded-md bg-white p-2 shadow-sm" style={{ maxWidth: 220 }}>
                  {/* Logo forcé : si crossOrigin échoue (CORS), on retente sans, sinon on garde un placeholder visible. */}
                  <img
                    src={displayCompanyLogo}
                    alt={displayCompanyName || 'Logo entreprise'}
                    className="object-contain"
                    style={{ maxHeight: 72, maxWidth: 200, width: 'auto', height: 'auto', display: 'block' }}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.crossOrigin) {
                        img.removeAttribute('crossorigin');
                        img.src = displayCompanyLogo + (displayCompanyLogo.includes('?') ? '&' : '?') + 't=' + Date.now();
                        return;
                      }
                      // Échec final : on cache uniquement l'image, pas le bloc entreprise.
                      img.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
            {displayCompanyName && (
              <h2 className="mb-1 text-xl font-bold text-foreground">{displayCompanyName}</h2>
            )}
            {displayCompanyAddress && (
              <p className="text-sm text-muted-foreground">{displayCompanyAddress}</p>
            )}
            {displayCompanyContact && (
              <p className="text-sm text-muted-foreground">{displayCompanyContact}</p>
            )}
            {companyInfo.registrationNumber && (
              <p className="mt-1 text-xs text-muted-foreground">N° Reg: {companyInfo.registrationNumber}</p>
            )}
            {companyInfo.taxId && (
              <p className="text-xs text-muted-foreground">ID Fiscal: {companyInfo.taxId}</p>
            )}
            <h1 className="mt-4 text-2xl font-bold text-primary sm:text-3xl">{getDocumentTitle()}</h1>
            <p className="text-lg font-semibold text-muted-foreground">{data.number}</p>
          </div>

          {/* Client and Document Info */}
          <div className="relative z-10 mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/35 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Informations Client</h3>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Nom:</strong> {data.clientName}</p>
              {data.clientContact && <p className="text-sm text-muted-foreground"><strong className="text-foreground">Contact:</strong> {data.clientContact}</p>}
            </div>
            <div className="rounded-lg bg-muted/35 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Informations Document</h3>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Date:</strong> {new Date(data.date).toLocaleDateString('fr-FR')}</p>
              {data.dueDate && <p className="text-sm text-muted-foreground"><strong className="text-foreground">Échéance:</strong> {new Date(data.dueDate).toLocaleDateString('fr-FR')}</p>}
              {data.paymentMethod && <p className="text-sm text-muted-foreground"><strong className="text-foreground">Paiement:</strong> {data.paymentMethod}</p>}
            </div>
          </div>

          {/* Items Table */}
          <table className="relative z-10 mb-6 w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-3 text-left font-semibold">Description</th>
                <th className="p-3 text-right font-semibold">Qté</th>
                <th className="p-3 text-right font-semibold">Prix unit.</th>
                <th className="p-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <td className="p-3 font-medium text-foreground">{item.name}</td>
                  <td className="p-3 text-right text-muted-foreground">{item.quantity}</td>
                  <td className="p-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-3 text-right font-semibold text-foreground">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="relative z-10 mb-6 flex justify-end">
            <div className="w-full rounded-lg bg-muted/35 p-4 sm:w-80">
              <div className="flex justify-between border-b border-border py-2 text-sm text-muted-foreground">
                <span>Sous-total:</span>
                <span className="font-medium text-foreground">{formatCurrency(data.subtotal)}</span>
              </div>
              {data.tax ? (
                <div className="flex justify-between border-b border-border py-2 text-sm text-muted-foreground">
                  <span>TVA ({data.taxRate || 20}%):</span>
                  <span className="font-medium text-foreground">{formatCurrency(data.tax)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t-2 border-primary py-3 text-xl font-bold text-primary">
                <span>TOTAL:</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="relative z-10 mb-6 rounded border-l-4 border-accent bg-accent/20 p-4">
              <h4 className="mb-1 text-sm font-semibold text-foreground">Notes / Conditions</h4>
              <p className="text-sm text-muted-foreground">{data.notes}</p>
            </div>
          )}

          {/* Aucune mention légale auto-générée : tout est saisi manuellement dans le champ "Notes" par l'utilisateur. */}

          {/* Cachet et signature */}
          {(displayStamp || displaySignature) && (
            <div className="relative z-10 mb-4 flex items-end justify-end gap-8">
              {displaySignature && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center rounded-md bg-white p-1" style={{ maxWidth: 180 }}>
                    <img
                      src={displaySignature}
                      alt="Signature"
                      className="object-contain"
                      style={{ maxHeight: 64, maxWidth: 160, width: 'auto', height: 'auto', display: 'block' }}
                      crossOrigin="anonymous"
                      onError={(e) => { (e.currentTarget.parentElement?.parentElement as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                  <span className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">Signature</span>
                </div>
              )}
              {displayStamp && (
                <div className="flex flex-col items-center">
                  <div
                    className="flex items-center justify-center rounded-md bg-white p-2"
                    style={{ maxWidth: 180, mixBlendMode: 'multiply' as React.CSSProperties['mixBlendMode'] }}
                  >
                    <img
                      src={displayStamp}
                      alt="Cachet"
                      className="object-contain"
                      style={{ maxHeight: 110, maxWidth: 160, width: 'auto', height: 'auto', display: 'block' }}
                      crossOrigin="anonymous"
                      onError={(e) => { (e.currentTarget.parentElement?.parentElement as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                  <span className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">Cachet</span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="relative z-10 border-t-2 border-border pt-4 text-center text-xs text-muted-foreground">
            <div className="flex justify-center mb-3">
              <div className="rounded bg-white p-2 shadow-sm">
                <QRCodeSVG
                  value={JSON.stringify({
                    type: data.type,
                    n: data.number,
                    d: data.date,
                    c: data.clientName,
                    t: data.total,
                    co: displayCompanyName,
                  })}
                  size={96}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
            <p>Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
            <p>Merci pour votre confiance</p>
            <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-primary">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-semibold">Émis par le logiciel AquaPilote</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 justify-end mt-3 sm:mt-4">
          <Button variant="outline" onClick={() => generatePDF('download')} className="w-full sm:w-auto text-sm">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={() => generatePDF('print')} className="w-full sm:w-auto text-sm">
            <Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            Imprimer
          </Button>
          {showConfirmButton && onConfirm && (
            <Button onClick={onConfirm} disabled={confirmDisabled} className="w-full text-sm sm:w-auto">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              {confirmLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptPreview;

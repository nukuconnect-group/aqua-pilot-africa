import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Eye, Printer } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useSales } from '@/hooks/useSales';
import ReceiptPreview, { ReceiptData } from './ReceiptPreview';
import { getCompanyDocumentFields, isSaleSettled } from '@/lib/salesDocumentUtils';
import { Plus } from 'lucide-react';
import type { SalesDocumentType } from '@/lib/salesDocumentHelpers';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientContact?: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: string;
  notes?: string;
  isPaid: boolean;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceManagerProps {
  onCreateDocument?: (type: SalesDocumentType) => void;
}

const InvoiceManager: React.FC<InvoiceManagerProps> = ({ onCreateDocument }) => {
  const { formatCurrency, t, companyInfo } = useSettings();
  const { sales } = useSales(); // déjà filtré par unité active dans le hook
  const [previewData, setPreviewData] = useState<ReceiptData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [initialAction, setInitialAction] = useState<'download' | 'print' | null>(null);

  const invoices = useMemo<Invoice[]>(() => {
    const today = new Date().toISOString().slice(0, 10);

    const computeDueDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const due = new Date(d);
      due.setDate(d.getDate() + 30);
      return due.toISOString().slice(0, 10);
    };

    const baseStatusFromSale = (saleStatus: string): InvoiceStatus => {
      if (saleStatus === 'paid') return 'paid';
      if (saleStatus === 'pending') return 'draft';
      return 'sent'; // confirmed / delivered
    };

    return sales.filter(s => s.documentType === 'invoice' || s.documentType === 'proforma')
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((sale) => {
        const dueDate = computeDueDate(sale.date);
        const items: InvoiceItem[] = sale.products.map((p, idx) => ({
          id: `${sale.id}-${idx}`,
          description: p.name,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          total: p.total,
        }));

        const subtotal = sale.totalAmount;
        const tax = 0;
        const total = subtotal + tax;

        let status: InvoiceStatus = baseStatusFromSale(sale.status);
        if (status !== 'paid' && dueDate < today) status = 'overdue';

        return {
          id: sale.id,
          invoiceNumber: sale.documentNumber || `${sale.documentType === 'proforma' ? 'PRO' : 'FAC'}-${sale.date.split('-').join('')}-${sale.id.slice(0, 6).toUpperCase()}`,
          clientName: sale.clientName,
          clientContact: sale.clientContact || undefined,
          date: sale.date,
          dueDate,
          items,
          subtotal,
          tax,
          total,
          status,
          paymentMethod: sale.paymentMethod || undefined,
          notes: sale.notes || undefined,
          isPaid: isSaleSettled(sale),
        };
      });
  }, [sales]);

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-muted text-muted-foreground';
      case 'sent':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200';
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200';
      case 'overdue':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft':
        return t('draft') || 'Brouillon';
      case 'sent':
        return t('sent') || 'Envoyée';
      case 'paid':
        return t('paid') || 'Payée';
      case 'overdue':
        return t('overdue') || 'En retard';
      default:
        return status;
    }
  };

  const buildInvoicePreviewData = (invoice: Invoice): ReceiptData => ({
    id: invoice.id,
    type: (sales.find(s => s.id === invoice.id)?.documentType || 'invoice') as any,
    number: invoice.invoiceNumber,
    date: invoice.date,
    dueDate: invoice.dueDate,
    clientName: invoice.clientName,
    clientContact: invoice.clientContact,
    items: invoice.items.map((item) => ({
      name: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    taxRate: invoice.subtotal > 0 && invoice.tax > 0 ? (invoice.tax / invoice.subtotal) * 100 : 0,
    total: invoice.total,
    paymentMethod: invoice.paymentMethod,
    notes: invoice.notes,
    isPaid: invoice.isPaid,
    ...getCompanyDocumentFields(companyInfo),
  });

  const openInvoicePreview = (invoice: Invoice, action?: 'download' | 'print') => {
    setPreviewData(buildInvoicePreviewData(invoice));
    setInitialAction(action || null);
    setShowPreview(true);
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    openInvoicePreview(invoice, 'download');
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    openInvoicePreview(invoice, 'print');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {t('invoiceManagement') || 'Factures'}
        </h3>
        <div className="mobile-action-grid grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {onCreateDocument && (
            <>
              <Button
                size="sm"
                onClick={() => onCreateDocument('invoice')}
                className="text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Créer une facture
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCreateDocument('proforma')}
                className="text-sm"
              >
                <FileText className="w-4 h-4 mr-1" />
                Créer une proforma
              </Button>
            </>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {invoices.length} facture{invoices.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-muted">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{invoices.filter((i) => i.status === 'draft').length}</p>
              <p className="text-sm text-muted-foreground">{t('drafts') || 'Brouillons'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-sky-600">{invoices.filter((i) => i.status === 'sent').length}</p>
              <p className="text-sm text-muted-foreground">{t('sent') || 'Envoyées'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{invoices.filter((i) => i.status === 'paid').length}</p>
              <p className="text-sm text-muted-foreground">{t('paidInvoices') || 'Payées'}</p>
              <p className="text-xs text-emerald-600 mt-1">
                {formatCurrency(invoices.filter((i) => i.status === 'paid').reduce((sum, inv) => sum + inv.total, 0))}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-rose-600">{invoices.filter((i) => i.status === 'overdue').length}</p>
              <p className="text-sm text-muted-foreground">{t('overdueInvoices') || 'En retard'}</p>
              {invoices.filter((i) => i.status === 'overdue').length > 0 && (
                <p className="text-xs text-rose-600 mt-1">
                  {formatCurrency(invoices.filter((i) => i.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0))}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceList') || 'Liste des factures'}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noInvoicesYet') || "Aucune facture: enregistrez d'abord des ventes."}</p>
          ) : (
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoiceNumber') || 'N°'}</TableHead>
                  <TableHead>{t('client') || 'Client'}</TableHead>
                  <TableHead>{t('date') || 'Date'}</TableHead>
                  <TableHead>{t('dueDate') || 'Échéance'}</TableHead>
                  <TableHead>{t('amount') || 'Montant'}</TableHead>
                  <TableHead>{t('status') || 'Statut'}</TableHead>
                  <TableHead>{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>{invoice.dueDate}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>{getStatusLabel(invoice.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openInvoicePreview(invoice)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice)}>
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(invoice)}>
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {previewData && (
        <ReceiptPreview
          open={showPreview}
          onOpenChange={(open) => {
            setShowPreview(open);
            if (!open) {
              setInitialAction(null);
            }
          }}
          data={previewData}
          showConfirmButton={false}
          initialAction={initialAction}
          onInitialActionComplete={() => setInitialAction(null)}
        />
      )}
    </div>
  );
};

export default InvoiceManager;

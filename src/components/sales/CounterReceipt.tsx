import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { CompanyInfo } from '@/contexts/SettingsContext';

export interface ReceiptData {
  number: string; date: string; client: string; payment: string; register: string;
  lines: { name: string; quantity: number; unitPrice: number }[]; total: number;
}

interface Props { receipt: ReceiptData; company: CompanyInfo; unitName?: string; format: (n: number) => string }

/** Ticket de comptoir 58 mm : logo, entreprise, lignes alignées, total, QR du numéro de reçu. */
const CounterReceipt = forwardRef<HTMLDivElement, Props>(({ receipt, company, unitName, format }, ref) => (
  <div ref={ref} className="ticket mx-auto w-[58mm] max-w-full bg-card px-2 py-3 font-mono text-[11px] leading-snug text-card-foreground">
    <div className="center text-center">
      {company.logoUrl && <img src={company.logoUrl} alt="" className="logo mx-auto mb-1 h-12 w-12 object-contain" />}
      <div className="title text-[13px] font-bold uppercase">{company.name || unitName}</div>
      {company.name && unitName && <div>{unitName}</div>}
      {company.address && <div>{company.address}</div>}
      {company.phone && <div>Tél : {company.phone}</div>}
      {(company.cifNif || company.taxId) && <div>NIF : {company.cifNif || company.taxId}</div>}
      {company.rccm && <div>RCCM : {company.rccm}</div>}
    </div>
    <div className="sep my-1.5 border-t border-dashed border-foreground/60" />
    <div className="kv flex justify-between gap-2"><span>Reçu</span><span className="font-semibold">{receipt.number}</span></div>
    <div className="kv flex justify-between gap-2"><span>Date</span><span>{receipt.date}</span></div>
    <div className="kv flex justify-between gap-2"><span>Caisse</span><span className="truncate">{receipt.register}</span></div>
    <div className="kv flex justify-between gap-2"><span>Client</span><span className="truncate">{receipt.client}</span></div>
    <div className="sep my-1.5 border-t border-dashed border-foreground/60" />
    {receipt.lines.map((l, i) => (
      <div key={i} className="line mb-1">
        <div className="name break-words font-semibold">{l.name}</div>
        <div className="kv flex justify-between gap-2 tabular-nums">
          <span>{l.quantity} × {format(l.unitPrice)}</span><span>{format(l.quantity * l.unitPrice)}</span>
        </div>
      </div>
    ))}
    <div className="sep my-1.5 border-t border-dashed border-foreground/60" />
    <div className="kv total flex justify-between gap-2 text-[13px] font-bold tabular-nums"><span>TOTAL</span><span>{format(receipt.total)}</span></div>
    <div className="kv flex justify-between gap-2"><span>Paiement</span><span>{receipt.payment}</span></div>
    <div className="sep my-1.5 border-t border-dashed border-foreground/60" />
    <div className="center flex flex-col items-center gap-1 text-center">
      <QRCodeSVG value={`${company.name || unitName || ''} | Reçu ${receipt.number} | ${receipt.date} | ${receipt.total}`} size={84} />
      <div>Merci de votre visite</div>
    </div>
  </div>
));
CounterReceipt.displayName = 'CounterReceipt';

export const RECEIPT_PRINT_CSS = `@page{size:58mm auto;margin:0}
body{margin:0;font-family:ui-monospace,monospace;font-size:11px;color:#000}
.ticket{width:58mm;padding:3mm 2mm;box-sizing:border-box}
.center{text-align:center;display:flex;flex-direction:column;align-items:center}
.logo{height:12mm;width:12mm;object-fit:contain;margin-bottom:1mm}
.title{font-size:13px;font-weight:700;text-transform:uppercase}
.sep{border-top:1px dashed #000;margin:1.5mm 0}
.kv{display:flex;justify-content:space-between;gap:2mm}
.name{font-weight:600}.line{margin-bottom:1mm}.total{font-size:13px;font-weight:700}`;

export default CounterReceipt;

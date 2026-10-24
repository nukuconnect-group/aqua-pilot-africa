import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { getInfrastructureTypeLabel } from '@/lib/unitContext';

export interface InfrastructureQrIdentity {
  id: string;
  unitId: string;
  name: string;
  type?: string;
  customTypeName?: string;
  specifications?: Record<string, unknown>;
}

export const infrastructureQrNumber = (infrastructure: InfrastructureQrIdentity): string | undefined => {
  const value = infrastructure.specifications?.number;
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
};

export const infrastructureQrType = (infrastructure: InfrastructureQrIdentity) =>
  infrastructure.customTypeName || (infrastructure.type ? getInfrastructureTypeLabel(infrastructure.type) : undefined);

export const infrastructureQrCaption = (infrastructure: InfrastructureQrIdentity) => {
  const number = infrastructureQrNumber(infrastructure);
  return [infrastructure.name, infrastructureQrType(infrastructure), number ? `N° ${number}` : `Réf. ${infrastructure.id}`].filter(Boolean).join(' — ');
};

/** Stable persisted identity plus current descriptive fields; no tokens or private specifications. */
export const infrastructureQrValue = (infrastructure: InfrastructureQrIdentity) =>
  JSON.stringify({ app: 'AquaPilote', type: 'infrastructure', unitId: infrastructure.unitId, infrastructureId: infrastructure.id,
    name: infrastructure.name, infrastructureType: infrastructureQrType(infrastructure), number: infrastructureQrNumber(infrastructure) });

/** Cycle IDs are not warehouse infrastructure IDs. Resolve only an unambiguous match in this unit. */
export function resolveInfrastructureQr(
  unitId: string,
  id: string | null | undefined,
  infrastructures: InfrastructureQrIdentity[],
  cycleInfrastructures: { id: string; infrastructure_name: string }[] = [],
): InfrastructureQrIdentity | undefined {
  if (!id) return undefined;
  const scoped = infrastructures.filter(i => i.unitId === unitId);
  const direct = scoped.find(i => i.id === id);
  if (direct) return direct;
  const cycle = cycleInfrastructures.find(i => i.id === id);
  if (!cycle) return undefined;
  const matches = scoped.filter(i => i.name.trim().toLocaleLowerCase() === cycle.infrastructure_name.trim().toLocaleLowerCase());
  return matches.length === 1 ? matches[0] : undefined;
}

export const infrastructureQrSvg = (infrastructure: InfrastructureQrIdentity, size = 112) =>
  renderToStaticMarkup(<QRCodeSVG xmlns="http://www.w3.org/2000/svg" value={infrastructureQrValue(infrastructure)} size={size} level="M" marginSize={4} />);

export const infrastructureQrDataUri = (infrastructure: InfrastructureQrIdentity) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(infrastructureQrSvg(infrastructure, 320))}`;

export async function infrastructureQrPng(infrastructure: InfrastructureQrIdentity): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('QR indisponible'));
    image.src = infrastructureQrDataUri(infrastructure);
  });
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('QR indisponible');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export function infrastructureQrHTML(infrastructure?: InfrastructureQrIdentity, imageSrc?: string): string {
  if (!infrastructure) return '';
  return `<figure style="margin:8px 0;display:inline-block;break-inside:avoid;text-align:center;max-width:176px">${imageSrc ? `<img src="${escapeHtml(imageSrc)}" width="144" height="144" alt="QR infrastructure">` : infrastructureQrSvg(infrastructure, 144)}<figcaption style="font:11px Arial,sans-serif;overflow-wrap:anywhere">${escapeHtml(infrastructureQrCaption(infrastructure))}</figcaption></figure>`;
}

/** Excel-compatible HTML preserves QR images, unlike the old tab-delimited XLS. */
export const infrastructureQrTableHTML = (rows: Array<Array<string | number>>, qrFigures: string) =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${qrFigures}<table border="1">${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
import { QRCodeSVG } from 'qrcode.react';
import { infrastructureQrValue, infrastructureQrCaption, type InfrastructureQrIdentity } from '@/lib/infrastructureQr';

export default function InfrastructureQRCode({ infrastructure, size = 144 }: { infrastructure: InfrastructureQrIdentity; size?: number }) {
  return (
    <figure className="m-0 flex max-w-48 shrink-0 flex-col items-center gap-1" aria-label={`QR de ${infrastructure.name}`}>
      <QRCodeSVG className="infrastructure-qr max-w-full" value={infrastructureQrValue(infrastructure)} size={size} level="M" marginSize={4} />
      <figcaption className="break-words text-center text-xs text-muted-foreground">{infrastructureQrCaption(infrastructure)}</figcaption>
    </figure>
  );
}
import { QRCodeSVG } from 'qrcode.react';
import { infrastructureQrValue, type InfrastructureQrIdentity } from '@/lib/infrastructureQr';

export default function InfrastructureQRCode({ infrastructure, size = 112 }: { infrastructure: InfrastructureQrIdentity; size?: number }) {
  return (
    <figure className="m-0 flex shrink-0 flex-col items-center gap-1" aria-label={`QR de ${infrastructure.name}`}>
      <QRCodeSVG className="infrastructure-qr max-w-full" value={infrastructureQrValue(infrastructure)} size={size} level="M" marginSize={4} />
      <figcaption className="text-xs text-muted-foreground">QR infrastructure</figcaption>
    </figure>
  );
}
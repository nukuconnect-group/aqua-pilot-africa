import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Printer, ScanLine, Smartphone } from 'lucide-react';
import { readDevicePrefs, writeDevicePrefs, scanChannelName, type DevicePrefs } from '@/lib/devicePrefs';
import { supabase } from '@/integrations/supabase/appClient';
import BarcodeScanner from '@/components/sales/BarcodeScanner';
import { useToast } from '@/hooks/use-toast';

const PeripheralsSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<DevicePrefs>(readDevicePrefs());
  const [phoneScan, setPhoneScan] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const { toast } = useToast();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const set = (p: Partial<DevicePrefs>) => { const n = { ...prefs, ...p }; setPrefs(n); writeDevicePrefs(n); };

  const sendCode = async (code: string) => {
    if (!userId) return;
    const ch = supabase.channel(scanChannelName(userId));
    await new Promise<void>((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()));
    await ch.send({ type: 'broadcast', event: 'scan', payload: { code } });
    supabase.removeChannel(ch);
    setSent((s) => [code, ...s].slice(0, 5));
    toast({ title: 'Code envoyé à la caisse', description: code });
  };

  const Row = ({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-4 w-4" /> Scanners</CardTitle></CardHeader>
        <CardContent>
          <Row title="Lecteur code-barres USB ou Bluetooth" desc="Branchez ou appairez le lecteur : à la caisse, chaque code scanné ajoute directement le produit." checked={prefs.hardwareScanner} onChange={(v) => set({ hardwareScanner: v })} />
          <Row title="Recevoir les scans d’un téléphone" desc="La caisse de ce poste reçoit les codes scannés par un téléphone connecté au même compte." checked={prefs.remoteScanner} onChange={(v) => set({ remoteScanner: v })} />
          <div className="pt-3">
            <Button variant="outline" onClick={() => setPhoneScan(true)}><Smartphone className="mr-2 h-4 w-4" /> Utiliser ce téléphone comme scanner</Button>
            <p className="mt-1 text-xs text-muted-foreground">Ouvrez AquaPilote sur le téléphone avec le même compte, touchez ce bouton et scannez : les produits arrivent dans la caisse ouverte sur l’ordinateur.</p>
            {sent.length > 0 && <p className="mt-2 text-xs">Derniers envois : <span className="font-mono">{sent.join(' · ')}</span></p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Printer className="h-4 w-4" /> Imprimante des reçus</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {([['58', 'Ticket 58 mm', 'Petite imprimante mobile'], ['80', 'Ticket 80 mm', 'Imprimante de comptoir'], ['A4', 'Feuille A4', 'Imprimante de bureau']] as const).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => set({ receiptFormat: v })}
                className={`rounded-md border p-3 text-left ${prefs.receiptFormat === v ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <span className="block text-sm font-semibold">{t}</span><span className="text-xs text-muted-foreground">{d}</span>
              </button>
            ))}
          </div>
          <Row title="Imprimer automatiquement après l’encaissement" desc="Ouvre l’impression du reçu dès que la vente est validée. Choisissez votre imprimante une fois dans la fenêtre d’impression : le navigateur la retient." checked={prefs.autoPrint} onChange={(v) => set({ autoPrint: v })} />
          <p className="text-xs text-muted-foreground">Ces réglages concernent uniquement cet appareil : chaque poste garde son imprimante et son scanner.</p>
        </CardContent>
      </Card>

      <BarcodeScanner open={phoneScan} onClose={() => setPhoneScan(false)} onScan={sendCode} />
    </div>
  );
};

export default PeripheralsSettings;

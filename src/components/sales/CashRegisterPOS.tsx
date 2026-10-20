import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Unlock, ScanLine, Sparkles, Minus, Plus, Trash2, ShoppingCart, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSales } from '@/hooks/useSales';
import { useCashSession } from '@/hooks/useCashSession';
import BarcodeScanner from './BarcodeScanner';

interface CartLine { name: string; quantity: number; unitPrice: number }

const PAYMENTS = ['Espèces', 'Mobile Money', 'Carte', 'Virement'];

/** Interprète une saisie libre du type « 20 kg tilapia, 5 silure à Kossi ». */
export const parseQuickSale = (text: string, catalog: { name: string; price: number }[]) => {
  const lines: CartLine[] = [];
  let client = '';
  const m = text.match(/\b(?:à|a|pour|client)\s+([^,]+)$/i);
  let body = text;
  if (m) { client = m[1].trim(); body = text.slice(0, m.index); }
  body.split(/,|\bet\b|\+/i).forEach((chunk) => {
    const q = chunk.match(/(\d+(?:[.,]\d+)?)/);
    if (!q) return;
    const qty = parseFloat(q[1].replace(',', '.'));
    const rest = chunk.toLowerCase();
    const prod = catalog.find((p) => rest.includes(p.name.toLowerCase()));
    if (prod && qty > 0) lines.push({ name: prod.name, quantity: qty, unitPrice: prod.price });
  });
  return { lines, client };
};

const CashRegisterPOS: React.FC = () => {
  const { toast } = useToast();
  const { formatCurrency } = useSettings();
  const { activeUnit } = useProductionUnits();
  const { sales, addSale } = useSales();
  const cash = useCashSession(activeUnit?.id);
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [client, setClient] = useState('');
  const [payment, setPayment] = useState('Espèces');
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveLabel, setMoveLabel] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTarget, setTransferTarget] = useState('');

  // Catalogue réel : produits déjà vendus dans cette unité, au dernier prix pratiqué.
  const catalog = useMemo(() => {
    const map = new Map<string, { name: string; price: number; count: number }>();
    [...sales].reverse().forEach((s) => s.products.forEach((p) => {
      if (!p.name) return;
      const cur = map.get(p.name.toLowerCase());
      map.set(p.name.toLowerCase(), { name: p.name, price: p.unitPrice, count: (cur?.count || 0) + p.quantity });
    }));
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [sales]);

  const filtered = catalog.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const sessionSales = cash.movements.filter((m) => m.type === 'sale');
  const sessionTotal = sessionSales.reduce((s, m) => s + m.amount, 0);

  const addToCart = (name: string, price: number, qty = 1) => setCart((prev) => {
    const i = prev.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, quantity: l.quantity + qty } : l));
    return [...prev, { name, quantity: qty, unitPrice: price }];
  });

  const updateLine = (i: number, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)).filter((l) => l.quantity > 0));

  const handleScan = (code: string) => {
    setScanOpen(false);
    const raw = code.trim();
    const prod = catalog.find((p) => p.name.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(p.name.toLowerCase()));
    if (prod) { addToCart(prod.name, prod.price); toast({ title: `${prod.name} ajouté` }); }
    else toast({ title: 'Produit inconnu', description: `Code « ${raw} » non trouvé dans vos produits.`, variant: 'destructive' });
  };

  const handleQuick = () => {
    const { lines, client: c } = parseQuickSale(quick, catalog);
    if (!lines.length) {
      toast({ title: 'Rien reconnu', description: 'Indiquez une quantité et un produit déjà vendu, ex. « 20 tilapia à Kossi ».', variant: 'destructive' });
      return;
    }
    lines.forEach((l) => addToCart(l.name, l.unitPrice, l.quantity));
    if (c) setClient(c);
    setQuick('');
  };

  const checkout = async () => {
    if (!activeUnit?.id || !cash.session || !cart.length || busy) return;
    setBusy(true);
    const sale = await addSale({
      date: new Date().toISOString().split('T')[0],
      clientName: client.trim() || 'Client comptoir',
      clientContact: '',
      unitId: activeUnit.id,
      products: cart.map((l) => ({ ...l, total: l.quantity * l.unitPrice })),
      totalAmount: total,
      status: 'paid',
      paymentMethod: payment,
      notes: 'Vente en caisse',
      paidAmount: total,
      documentType: 'receipt',
      taxRate: 0,
    });
    if (!sale) {
      setBusy(false);
      toast({ title: 'Vente non enregistrée', variant: 'destructive' });
      return;
    }
    const res = await cash.addMovement({ type: 'sale', amount: total, payment_method: payment, sale_id: sale.id, label: sale.documentNumber || sale.clientName });
    setBusy(false);
    if (res.error) toast({ title: 'Vente enregistrée, caisse non mise à jour', description: res.error, variant: 'destructive' });
    else toast({ title: 'Vente encaissée', description: `${formatCurrency(total)} — ${sale.documentNumber || ''}` });
    setCart([]); setClient('');
  };

  if (!activeUnit) return <Alert><AlertDescription>Sélectionnez une unité de production pour ouvrir la caisse.</AlertDescription></Alert>;

  if (cash.notInstalled) return (
    <Alert>
      <AlertDescription>
        La caisse n'est pas encore activée sur votre serveur. Le fichier d'installation « cash_register.sql » doit y être exécuté une fois.
      </AlertDescription>
    </Alert>
  );

  if (!cash.session) return (
    <Card className="max-w-md mx-auto rounded-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lock className="w-5 h-5 text-primary" />Caisse fermée — {activeUnit.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="text-sm text-muted-foreground">Fond de caisse (espèces au départ)</label>
        <Input type="number" min="0" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        <Button className="w-full" onClick={async () => {
          const r = await cash.openSession(Number(opening) || 0);
          if (r.error) toast({ title: 'Ouverture impossible', description: r.error, variant: 'destructive' });
          else { setOpening(''); toast({ title: 'Caisse ouverte' }); }
        }}><Unlock className="w-4 h-4 mr-2" />Ouvrir la caisse</Button>
        {cash.history.length > 0 && (
          <div className="pt-2 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Dernières clôtures</p>
            {cash.history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex justify-between text-xs border-b border-border py-1">
                <span>{new Date(h.closed_at || h.opened_at).toLocaleString('fr-FR')}</span>
                <span className={Number(h.difference) === 0 ? 'text-muted-foreground' : 'text-destructive'}>
                  Écart {formatCurrency(Number(h.difference) || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Caisse ouverte</Badge>
        <span className="text-xs text-muted-foreground">depuis {new Date(cash.session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-sm ml-auto">Ventes : <b>{formatCurrency(sessionTotal)}</b> ({sessionSales.length})</span>
        <span className="text-sm">Espèces attendues : <b>{formatCurrency(cash.expected)}</b></span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-2xl">
          <CardContent className="p-3 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Rechercher un produit" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scanner un code"><ScanLine className="w-4 h-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Saisie rapide : 20 tilapia, 5 silure à Kossi" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuick()} />
              <Button variant="secondary" onClick={handleQuick}><Sparkles className="w-4 h-4 mr-1" />Ajouter</Button>
            </div>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun produit encore vendu dans cette unité. Utilisez « Nouvelle vente » pour enregistrer un premier produit, il apparaîtra ensuite ici.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {filtered.map((p) => (
                  <button key={p.name} onClick={() => addToCart(p.name, p.price)}
                    className="rounded-xl border border-border bg-background p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(p.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Panier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Touchez un produit pour l'ajouter.</p>}
            {cart.map((l, i) => (
              <div key={l.name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <Input type="number" className="h-7 text-xs mt-1 w-28" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })} />
                </div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateLine(i, { quantity: l.quantity - 1 })}><Minus className="w-3 h-3" /></Button>
                <Input type="number" className="h-7 w-14 text-center text-xs" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateLine(i, { quantity: l.quantity + 1 })}><Plus className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateLine(i, { quantity: 0 })}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Input placeholder="Nom du client (facultatif)" value={client} onChange={(e) => setClient(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {PAYMENTS.map((p) => (
                <Button key={p} size="sm" variant={payment === p ? 'default' : 'outline'} onClick={() => setPayment(p)}>{p}</Button>
              ))}
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(total)}</span></div>
            <Button className="w-full h-12 text-base" disabled={!cart.length || busy} onClick={checkout}>{busy ? 'Encaissement…' : 'Encaisser'}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Entrée / sortie d'espèces</p>
            <div className="flex gap-2">
              <Input type="number" placeholder="Montant" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} />
              <Input placeholder="Motif" value={moveLabel} onChange={(e) => setMoveLabel(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(['cash_in', 'cash_out'] as const).map((t) => (
                <Button key={t} size="sm" variant="outline" className="flex-1" onClick={async () => {
                  const a = Number(moveAmount);
                  if (!a || a <= 0) return;
                  const r = await cash.addMovement({ type: t, amount: a, label: moveLabel });
                  if (r.error) toast({ title: 'Erreur', description: r.error, variant: 'destructive' });
                  else { setMoveAmount(''); setMoveLabel(''); }
                }}>
                  {t === 'cash_in' ? <><ArrowDownCircle className="w-4 h-4 mr-1" />Entrée</> : <><ArrowUpCircle className="w-4 h-4 mr-1" />Sortie</>}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Fermer la caisse</p>
            <Input type="number" placeholder="Espèces comptées" value={counted} onChange={(e) => setCounted(e.target.value)} />
            {counted !== '' && <p className="text-xs">Écart : <b>{formatCurrency((Number(counted) || 0) - cash.expected)}</b></p>}
            <Button variant="destructive" size="sm" className="w-full" disabled={counted === ''} onClick={async () => {
              const r = await cash.closeSession(Number(counted) || 0);
              if (r.error) toast({ title: 'Clôture impossible', description: r.error, variant: 'destructive' });
              else { setCounted(''); toast({ title: 'Caisse fermée' }); }
            }}><Lock className="w-4 h-4 mr-1" />Clôturer</Button>
          </div>
        </CardContent>
      </Card>

      {cash.movements.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-base">Mouvements de la session</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cash.movements.map((m) => (
              <div key={m.id} className="flex justify-between text-sm border-b border-border py-1">
                <span>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {m.type === 'sale' ? 'Vente' : m.type === 'cash_in' ? 'Entrée' : 'Sortie'} {m.label ? `· ${m.label}` : ''} · {m.payment_method}</span>
                <span className={m.type === 'cash_out' ? 'text-destructive' : ''}>{m.type === 'cash_out' ? '-' : ''}{formatCurrency(m.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
};

export default CashRegisterPOS;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Unlock, ScanLine, Sparkles, Mic, Printer, Minus, Plus, Trash2, ShoppingCart, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSales } from '@/hooks/useSales';
import { useCashSession } from '@/hooks/useCashSession';
import BarcodeScanner from './BarcodeScanner';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import CashierAssignDialog from './CashierAssignDialog';
import { useAuth } from '@/contexts/AuthContext';
import { deductSoldStock, findStockShortage, postSaleAtomically } from '@/lib/posStock';
import { buildPosCatalog, calculatePosTotal, isValidPosCart, normalizeProductSearch } from '@/lib/posCatalog';
import CashSalesHistory from './CashSalesHistory';
import PosAiSuggestions from './PosAiSuggestions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Sale } from '@/hooks/useSales';

interface CartLine { name: string; quantity: number; unitPrice: number }

const PAYMENTS = ['Espèces', 'Mobile Money', 'Carte', 'Virement'];

const checkoutRecovery = (error: unknown, saleRecorded: boolean) => {
  const detail = typeof error === 'string' ? error : error && typeof error === 'object'
    ? `${'code' in error ? error.code : ''} ${'message' in error ? error.message : ''}` : '';
  const preserve = saleRecorded
    ? 'La vente est enregistrée, mais son encaissement n’est pas confirmé. Ne recréez pas la vente et ne demandez pas un second paiement.'
    : 'L’encaissement n’est pas confirmé. Votre panier est conservé.';
  if (/fermée|closed/i.test(detail)) return `${preserve} ${saleRecorded
    ? 'La caisse d’origine est fermée. Demandez au responsable de régulariser cette vente dans cette caisse, puis vérifiez l’historique.'
    : 'Choisissez une caisse ouverte ou ouvrez une nouvelle caisse, puis réessayez.'}`;
  if (/42501|permission|not authorized|forbidden|accès|droits/i.test(detail)) return `${preserve} Demandez au responsable de vérifier votre accès à cette caisse avant de réessayer.`;
  if (/401|jwt|session.*expir|not authenticated/i.test(detail)) return `${preserve} Votre connexion a expiré. Avant de vous reconnecter, notez la caisse et le montant${saleRecorded ? ' ainsi que la référence de vente' : ''}. Après reconnexion, vérifiez l’historique avant toute nouvelle tentative.`;
  if (/fetch|network|réseau|connexion|timeout|timed out|interromp/i.test(detail)) return `${preserve} Vérifiez votre connexion Internet, gardez cette page ouverte, puis cliquez sur « ${saleRecorded ? 'Reprendre l’encaissement' : 'Encaisser'} ».`;
  return `${preserve} Gardez cette page ouverte et ${saleRecorded ? 'cliquez sur « Reprendre l’encaissement » pour mettre à jour la caisse d’origine' : 'vérifiez que la caisse est ouverte, puis cliquez sur « Encaisser »'}. Si l’échec persiste, contactez le responsable avec le nom de la caisse et le montant.`;
};

/** Interprète une saisie libre du type « 20 kg tilapia, 5 silure à Kossi ». */
export const parseQuickSale = (text: string, catalog: { name: string; price: number }[]) => {
  const lines: CartLine[] = [];
  let client = '';
  const m = text.match(/(?:^|\s)(?:à|a|pour|client)\s+([^,\d]+)$/i);
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
  const { activeUnit, units = [], setActiveUnit } = useProductionUnits();
  const { sales, addSale } = useSales();
  const { user } = useAuth();
  const unitOwner = (activeUnit as any)?.userId || (activeUnit as any)?.user_id;
  const isAdmin = !unitOwner || unitOwner === user?.id;
  const cash = useCashSession(activeUnit?.id, unitOwner);
  const { stocks, refetch: refetchStocks } = useFeedStocks(activeUnit?.id);
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
  const [openRegister, setOpenRegister] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ sale: Sale; sessionId: string } | null>(null);
  const paymentLock = useRef(false);
  const requestKey = useRef<string>();
  const [contact, setContact] = useState('');
  const [receipt, setReceipt] = useState<{ number: string; date: string; client: string; payment: string; register: string; lines: CartLine[]; total: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [unitConfirmed, setUnitConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    setCart([]); setClient(''); setContact(''); setPendingPayment(null);
    setCheckoutError(null);
    setTransferTarget(''); setSearch(''); requestKey.current = undefined;
  }, [activeUnit?.id]);

  const catalog = useMemo(() => activeUnit?.id ? buildPosCatalog(activeUnit.id, sales, stocks) : [], [activeUnit?.id, sales, stocks]);

  const filtered = catalog.filter((p) => normalizeProductSearch(p.name).includes(normalizeProductSearch(search)) || p.codes.some(c => c.toLowerCase() === search.trim().toLowerCase()));
  const total = calculatePosTotal(cart);
  const sessionSales = cash.movements.filter((m) => m.type === 'sale');
  const sessionTotal = sessionSales.reduce((s, m) => s + m.amount, 0);

  const addToCart = (name: string, price: number, qty = 1) => setCart((prev) => {
    const i = prev.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, quantity: l.quantity + qty } : l));
    return [...prev, { name, quantity: qty, unitPrice: price }];
  });

  const updateLine = (i: number, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const handleScan = (code: string) => {
    setScanOpen(false);
    const raw = code.trim();
    const prod = catalog.find((p) => p.codes.some(c => c.toLowerCase() === raw.toLowerCase()) || normalizeProductSearch(p.name) === normalizeProductSearch(raw));
    if (prod) { addToCart(prod.name, prod.price); toast({ title: `${prod.name} ajouté` }); }
    else toast({ title: 'Produit inconnu', description: `Code « ${raw} » non trouvé dans vos produits.`, variant: 'destructive' });
  };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: 'Dictée indisponible', description: 'Ce navigateur ne permet pas la dictée. Utilisez Chrome ou tapez la vente.', variant: 'destructive' }); return; }
    const rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = false;
    rec.onresult = (e: any) => { const text = e.results[0][0].transcript as string; setQuick(text); handleQuick(text); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); toast({ title: 'Dictée interrompue', description: 'Autorisez le micro puis réessayez.', variant: 'destructive' }); };
    setListening(true); rec.start();
  };

  const printReceipt = () => {
    if (!receipt) return;
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const rows = receipt.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${esc(formatCurrency(l.quantity * l.unitPrice))}</td></tr>`).join('');
    w.document.write(`<html><head><title>Reçu ${esc(receipt.number)}</title><style>body{font-family:monospace;font-size:12px;padding:8px}table{width:100%;border-collapse:collapse}td{padding:2px 0}h2{text-align:center;margin:4px 0}</style></head><body><h2>${esc(activeUnit?.name || '')}</h2><p>Reçu : ${esc(receipt.number)}<br/>Date : ${esc(receipt.date)}<br/>Caisse : ${esc(receipt.register)}<br/>Client : ${esc(receipt.client)}</p><table>${rows}</table><hr/><p><b>Total : ${esc(formatCurrency(receipt.total))}</b><br/>Paiement : ${esc(receipt.payment)}</p><p style="text-align:center">Merci</p></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const handleQuick = (input?: string) => {
    const { lines, client: c } = parseQuickSale(input ?? quick, catalog);
    if (!lines.length) {
      toast({ title: 'Rien reconnu', description: 'Indiquez une quantité et un produit déjà vendu, ex. « 20 tilapia à Kossi ».', variant: 'destructive' });
      return;
    }
    lines.forEach((l) => addToCart(l.name, l.unitPrice, l.quantity));
    if (c) setClient(c);
    setQuick('');
  };

  const checkout = async () => {
    if (!activeUnit?.id || !cash.session || paymentLock.current || (!pendingPayment && !isValidPosCart(cart))) return;
    paymentLock.current = true;
    setBusy(true);
    setCheckoutError(null);
    const sessionId = pendingPayment?.sessionId || cash.session.id;
    let recordedSale = pendingPayment?.sale;
    const reportFailure = (title: string, error: unknown) => {
      const failure = { title, description: checkoutRecovery(error, !!recordedSale) };
      setCheckoutError(failure);
      toast({ ...failure, variant: 'destructive' });
    };
    requestKey.current ||= crypto.randomUUID();
    try {
    if (!pendingPayment) {
      const shortage = findStockShortage(cart, catalog);
      if (shortage) { const f = { title: 'Stock insuffisant', description: `${shortage} Réduisez la quantité dans le panier.` }; setCheckoutError(f); toast({ ...f, variant: 'destructive' }); return; }
      const availability = await cash.validateSession(sessionId);
      if (availability.error) {
        reportFailure('Encaissement impossible', availability.error);
        return;
      }
    }
    const sale = pendingPayment?.sale || await addSale({
      clientRequestId: requestKey.current,
      date: new Date().toISOString().split('T')[0],
      clientName: client.trim() || 'Client comptoir',
      clientContact: contact.trim(),
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
      reportFailure('Vente non confirmée', undefined);
      return;
    }
    recordedSale = sale;
    setPendingPayment({ sale, sessionId });
    let posted = false;
    try {
      posted = await postSaleAtomically(activeUnit.id, sale.id, sessionId, cart);
    } catch (e) {
      reportFailure('Vente enregistrée, encaissement à reprendre', e instanceof Error ? e.message : undefined);
      return;
    }
    if (posted) {
      await cash.reload();
      refetchStocks?.();
    } else {
      const res = await cash.addMovement({ type: 'sale', amount: sale.totalAmount, payment_method: sale.paymentMethod, sale_id: sale.id, label: sale.documentNumber || sale.clientName }, sessionId);
      if (res.error) {
        reportFailure('Vente enregistrée, encaissement à reprendre', res.error);
        return;
      }
      try {
        await deductSoldStock(activeUnit.id, sale.id, cart);
        refetchStocks?.();
      } catch {
        toast({ title: 'Vente encaissée, stock à corriger', description: 'La sortie de stock n’a pas pu être enregistrée. Corrigez la quantité dans Stock.', variant: 'destructive' });
      }
    }
    toast({ title: 'Vente encaissée', description: `${formatCurrency(sale.totalAmount)} — ${sale.documentNumber || ''}` });
    setReceipt({
      number: sale.documentNumber || sale.id.slice(0, 8).toUpperCase(),
      date: new Date().toLocaleString('fr-FR'),
      client: sale.clientName || 'Client comptoir',
      payment: sale.paymentMethod || payment,
      register: cash.sessions.find((s) => s.id === sessionId)?.name || 'Caisse',
      lines: sale.products?.length ? sale.products.map((p: any) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice })) : cart,
      total: sale.totalAmount,
    });
    setPendingPayment(null); requestKey.current = undefined;
    setCart([]); setClient(''); setContact('');
    } catch (error) {
      reportFailure('Encaissement interrompu', error);
    } finally { setBusy(false); paymentLock.current = false; }
  };

  if (!activeUnit || (units.length > 1 && !unitConfirmed)) return (
    <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Avec quelle unité voulez-vous vendre ?</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {units.length === 0 ? <p className="text-sm text-muted-foreground">Aucune unité disponible.</p> : units.map((u) => (
          <Button key={u.id} variant="outline" className="h-auto justify-start p-3 text-left whitespace-normal" onClick={() => { setActiveUnit(u); setUnitConfirmed(true); }}>{u.name}</Button>
        ))}
      </CardContent></Card>
  );

  if (cash.loading && !cash.session) return <p className="text-sm text-muted-foreground">Chargement des caisses…</p>;
  if (cash.notInstalled) return (
    <Alert><AlertDescription>La caisse se prépare pour votre compte. Revenez dans quelques instants.<Button variant="outline" className="ml-2" onClick={() => cash.reload()}>Actualiser</Button></AlertDescription></Alert>
  );
  if (cash.error) return (
    <Alert><AlertDescription>Les caisses n’ont pas pu s’afficher. Cliquez sur « Réessayer ».<Button variant="outline" className="ml-2" onClick={() => cash.reload()}>Réessayer</Button></AlertDescription></Alert>
  );

  const openingForm = <div className="space-y-3">
    <label className="text-sm text-muted-foreground">Nom de la caisse</label>
    <Input aria-label="Nom de la nouvelle caisse" value={registerName} onChange={e => setRegisterName(e.target.value)} />
    <label className="text-sm text-muted-foreground">Fond de caisse</label>
    <Input type="number" min="0" aria-label="Fond de caisse" value={opening} onChange={e => setOpening(e.target.value)} placeholder="0" />
    <Button className="w-full" disabled={busy || !registerName.trim() || Number(opening) < 0} onClick={async () => {
      setBusy(true);
      try {
        const r = await cash.openSession(Number(opening) || 0, registerName);
        if (r.error) toast({ title: 'Ouverture impossible', description: r.error, variant: 'destructive' });
        else { setOpening(''); setRegisterName(''); setOpenRegister(false); toast({ title: 'Caisse ouverte' }); }
      } finally { setBusy(false); }
    }}><Unlock className="w-4 h-4 mr-2" />Ouvrir la caisse</Button>
  </div>;

  if (!cash.session) return (
    <div className="space-y-6"><Card className="max-w-md mx-auto rounded-lg">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lock className="w-5 h-5 text-primary" />Ouvrir une caisse — {activeUnit.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isAdmin ? openingForm : <p className="text-sm text-muted-foreground">Aucune caisse ouverte ne vous est attribuée. Demandez à l’administrateur de vous ajouter comme caissier.</p>}
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
    </Card><h3 className="font-semibold">Historique des ventes en caisse</h3><CashSalesHistory key={activeUnit.id} sessions={cash.history} movements={cash.allMovements} sales={sales} /></div>
  );

  return (
    <div className="space-y-3">
      <Dialog open={openRegister} onOpenChange={setOpenRegister}><DialogContent><DialogHeader><DialogTitle>Ouvrir une nouvelle caisse</DialogTitle></DialogHeader>{openingForm}</DialogContent></Dialog>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        {units.length > 1 && <Button variant="ghost" size="sm" disabled={busy || !!pendingPayment} onClick={() => setUnitConfirmed(false)}>{activeUnit.name} · Changer d’unité</Button>}
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Caisse ouverte</Badge>
        {cash.sessions.length > 1 ? (
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={cash.session.id}
            disabled={busy || !!pendingPayment}
            onChange={(e) => cash.setActiveSession(e.target.value)}
            aria-label="Choisir la caisse"
          >
            {cash.sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name || 'Caisse'} — ouverte {new Date(s.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium">{cash.session.name || 'Caisse principale'}</span>
        )}
        <span className="text-xs text-muted-foreground">depuis {new Date(cash.session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-sm ml-auto">Ventes : <b>{formatCurrency(sessionTotal)}</b> ({sessionSales.length})</span>
        <span className="text-sm">Espèces attendues : <b>{formatCurrency(cash.expected)}</b></span>
        {isAdmin && <CashierAssignDialog sessionId={cash.session.id} current={(cash.session as any).cashier_ids || []} onSaved={() => cash.reload()} />}
        {isAdmin && <Button variant="outline" size="sm" disabled={busy || !!pendingPayment} onClick={() => setOpenRegister(true)}><Plus className="h-4 w-4 mr-1" />Nouvelle caisse</Button>}
      </div>

      <Tabs defaultValue="checkout"><TabsList><TabsTrigger value="checkout">Vendre</TabsTrigger><TabsTrigger value="history">Historique des ventes</TabsTrigger></TabsList>
      <TabsContent value="history"><CashSalesHistory key={activeUnit.id} sessions={[...cash.sessions, ...cash.history]} movements={cash.allMovements} sales={sales} activeSessionId={cash.session.id} /></TabsContent>
      <TabsContent value="checkout" className="space-y-3">
      {checkoutError && <Alert variant="destructive"><AlertDescription><p className="font-semibold">{checkoutError.title}</p><p>{checkoutError.description}</p>{pendingPayment && <p className="mt-2">Vente : {pendingPayment.sale.documentNumber || pendingPayment.sale.id} · Montant : {formatCurrency(pendingPayment.sale.totalAmount)} · Caisse : {cash.sessions.find(s => s.id === pendingPayment.sessionId)?.name || pendingPayment.sessionId}</p>}</AlertDescription></Alert>}
      {pendingPayment && <Alert><AlertDescription>La vente est enregistrée. Reprenez l’encaissement pour mettre à jour sa caisse, sans recréer la vente.</AlertDescription></Alert>}
      <fieldset disabled={busy || !!pendingPayment} className="min-w-0 space-y-3">

      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-2xl">
          <CardContent className="p-3 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Rechercher un produit ou un code" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filtered.length === 1) addToCart(filtered[0].name, filtered[0].price); }} />
              <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scanner un code"><ScanLine className="w-4 h-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Dites ou tapez : 5 kg tilapia, 2 silure à Kossi" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuick()} />
              <Button variant="outline" onClick={startVoice} disabled={listening} aria-label="Dicter la vente"><Mic className={`w-4 h-4 ${listening ? 'text-destructive animate-pulse' : ''}`} /></Button>
              <Button variant="secondary" onClick={() => handleQuick()}><Sparkles className="w-4 h-4 mr-1" />Ajouter</Button>
            </div>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun stock commercial disponible. Dans Stock, ajoutez ou modifiez un article en choisissant « Stock commercial » avec son prix de vente.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {filtered.map((p) => (
                  <Button key={p.key} variant="outline" onClick={() => addToCart(p.name, p.price)}
                    className="h-auto min-h-20 w-full flex-col items-start rounded-lg p-3 text-left whitespace-normal">
                    <span className="text-sm font-semibold break-words">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.price > 0 ? formatCurrency(p.price) : 'Prix à renseigner'}</span>
                    {p.quantity !== undefined && <span className="text-xs text-muted-foreground">Stock : {p.quantity} {p.unit}</span>}
                  </Button>
                ))}
              </div>
            )}
            {catalog.length > 0 && !filtered.length && <p className="text-sm text-muted-foreground">Aucun produit trouvé.</p>}
            <Button variant="outline" onClick={() => setCart(prev => [...prev, { name: search.trim(), quantity: 1, unitPrice: 0 }])}><Plus className="h-4 w-4 mr-2" />Ajouter un produit</Button>
          </CardContent>
        </Card>
        <PosAiSuggestions cart={cart} catalog={catalog} formatCurrency={formatCurrency}
          onConfirm={(lines) => {
            setCart(prev => {
              const next = [...prev];
              lines.forEach(l => {
                const k = next.findIndex(x => x.name.toLowerCase() === l.name.toLowerCase());
                if (k >= 0) next[k] = { ...next[k], quantity: Math.max(next[k].quantity, l.quantity) };
                else next.push({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice });
              });
              return next;
            });
            toast({ title: 'Propositions ajoutées au panier', description: 'Vérifiez puis encaissez.' });
          }} />

        <Card className="rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Panier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Touchez un produit pour l'ajouter.</p>}
            {cart.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <div className="flex-1 min-w-0">
                  <Input aria-label={`Produit ${i + 1}`} className="h-8" value={l.name} onChange={e => updateLine(i, { name: e.target.value })} />
                  <label className="block text-xs text-muted-foreground mt-2">Prix unitaire<Input aria-label={`Prix unitaire ${i + 1}`} min="0" step="any" type="number" className="h-8 mt-1" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })} /></label>
                </div>
                <Button size="icon" variant="outline" aria-label={`Diminuer la quantité ${i + 1}`} className="h-7 w-7" disabled={l.quantity <= 1} onClick={() => updateLine(i, { quantity: l.quantity - 1 })}><Minus className="w-3 h-3" /></Button>
                <Input aria-label={`Quantité ${i + 1}`} min="0" step="any" type="number" className="h-7 w-16 text-center text-xs" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
                <Button size="icon" variant="outline" aria-label={`Augmenter la quantité ${i + 1}`} className="h-7 w-7" onClick={() => updateLine(i, { quantity: l.quantity + 1 })}><Plus className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Retirer le produit ${i + 1}`} className="h-7 w-7" onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Input placeholder="Nom du client (facultatif)" value={client} onChange={(e) => setClient(e.target.value)} />
            <Input placeholder="Téléphone ou email du client (facultatif)" value={contact} onChange={e => setContact(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {PAYMENTS.map((p) => (
                <Button key={p} size="sm" variant={payment === p ? 'default' : 'outline'} onClick={() => setPayment(p)}>{p}</Button>
              ))}
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </CardContent>
        </Card>
      </div>
      </fieldset>
      <Button className="w-full h-12 text-base" disabled={busy || (!pendingPayment && !isValidPosCart(cart))} onClick={checkout}>{busy ? 'Encaissement…' : pendingPayment ? 'Reprendre l’encaissement' : `Encaisser · ${formatCurrency(total)}`}</Button>

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
            <p className="text-sm font-semibold">Transfert vers une autre caisse</p>
            {cash.sessions.length < 2 ? (
              <p className="text-xs text-muted-foreground">Ouvrez une seconde caisse pour pouvoir transférer des espèces entre caisses.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Montant" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                  <select
                    className="h-10 rounded-md border border-border bg-background px-2 text-sm flex-1"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    aria-label="Caisse de destination"
                  >
                    <option value="">Caisse de destination…</option>
                    {cash.sessions.filter((s) => s.id !== cash.session?.id).map((s) => (
                      <option key={s.id} value={s.id}>{s.name || 'Caisse'}</option>
                    ))}
                  </select>
                </div>
                <Button size="sm" variant="outline" className="w-full" disabled={!transferTarget || !transferAmount} onClick={async () => {
                  const r = await cash.transferTo(transferTarget, Number(transferAmount) || 0);
                  if (r.error) toast({ title: 'Transfert impossible', description: r.error, variant: 'destructive' });
                  else { setTransferAmount(''); setTransferTarget(''); toast({ title: 'Transfert enregistré' }); }
                }}>Transférer</Button>
              </>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Fermer la caisse</p>
            <Input type="number" placeholder="Espèces comptées" value={counted} onChange={(e) => setCounted(e.target.value)} />
            {counted !== '' && <p className="text-xs">Écart : <b>{formatCurrency((Number(counted) || 0) - cash.expected)}</b></p>}
            <Button variant="destructive" size="sm" className="w-full" disabled={counted === '' || busy || !!pendingPayment} onClick={async () => {
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
      </TabsContent></Tabs>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Reçu {receipt?.number}</DialogTitle></DialogHeader>
        {receipt && <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{receipt.date} · {receipt.register} · {receipt.client}</p>
          {receipt.lines.map((l, i) => <div key={i} className="flex justify-between border-b border-border py-1"><span>{l.name} × {l.quantity}</span><span>{formatCurrency(l.quantity * l.unitPrice)}</span></div>)}
          <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatCurrency(receipt.total)}</span></div>
          <p className="text-muted-foreground">Paiement : {receipt.payment}</p>
          <Button className="w-full" onClick={printReceipt}><Printer className="w-4 h-4 mr-2" />Imprimer le reçu</Button>
        </div>}
      </DialogContent></Dialog>
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
};

export default CashRegisterPOS;

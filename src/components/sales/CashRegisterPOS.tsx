import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Unlock, ScanLine, Sparkles, Mic, Printer, Minus, Plus, Trash2, ShoppingCart, ArrowDownCircle, ArrowUpCircle, RotateCcw, Boxes, MoreHorizontal, KeyRound } from 'lucide-react';
import { useTreasury } from '@/hooks/useTreasury';
import CashDiscrepancies from './CashDiscrepancies';
import { summarizeSession, carriedOverBalance, cashDifference } from '@/lib/cashBalance';
import { supabase as appSupabase } from '@/integrations/supabase/appClient';
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
import { postSaleToTreasury, hasRegisterAccount, paymentDestination } from '@/lib/posTreasury';
import { buildPosCatalog, calculatePosTotal, isValidPosCart, normalizeProductSearch, type PosProduct } from '@/lib/posCatalog';
import { useProductImages } from '@/hooks/useProductImages';
import CashSalesHistory from './CashSalesHistory';
import PosAiSuggestions from './PosAiSuggestions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Sale } from '@/hooks/useSales';

interface CartLine { name: string; quantity: number; unitPrice: number; pack?: { label: string; size: number } }

const PAYMENTS = ['Espèces', 'Mobile Money', 'Carte bancaire', 'Virement bancaire'];

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

export type PosView = 'registers' | 'checkout' | 'multi' | 'ai';

const CashRegisterPOS: React.FC<{ view?: PosView; onNavigate?: (view: PosView) => void }> = ({ view = 'checkout', onNavigate }) => {
  const { toast } = useToast();
  const { formatCurrency } = useSettings();
  const { activeUnit, units = [], setActiveUnit } = useProductionUnits();
  const { sales, addSale } = useSales();
  const { user } = useAuth();
  const unitOwner = (activeUnit as any)?.userId || (activeUnit as any)?.user_id;
  const isAdmin = !unitOwner || unitOwner === user?.id;
  const cash = useCashSession(activeUnit?.id, unitOwner);
  const { stocks, refetch: refetchStocks, updateStock } = useFeedStocks(activeUnit?.id);
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tickets, setTickets] = useState<{ id: number; cart: CartLine[]; client: string }[]>([{ id: 1, cart: [], client: '' }]);
  const [activeTicket, setActiveTicket] = useState(1);
  const [opsOpen, setOpsOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [client, setClient] = useState('');
  const [payment, setPayment] = useState('Espèces');
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockAsk, setLockAsk] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const lastActivity = useRef(Date.now());
  const LOCK_AFTER_MS = 5 * 60 * 1000;
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch));
    const timer = window.setInterval(() => { if (Date.now() - lastActivity.current > LOCK_AFTER_MS) setLocked(true); }, 15000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); window.clearInterval(timer); };
  }, []);
  const unlock = async () => {
    setUnlockError('');
    if (!user?.email) { setUnlockError('Compte introuvable.'); return; }
    const { error } = await appSupabase.auth.signInWithPassword({ email: user.email, password: unlockPassword });
    if (error) { setUnlockError('Mot de passe incorrect.'); return; }
    setUnlockPassword(''); lastActivity.current = Date.now(); setLocked(false);
  };
  const [moveAmount, setMoveAmount] = useState('');
  const [moveLabel, setMoveLabel] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [transferPerson, setTransferPerson] = useState('');
  const [dayCount, setDayCount] = useState('');
  const treasury = useTreasury(activeUnit?.id);
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
  const productImages = useProductImages(useMemo(() => catalog.map(p => p.name), [catalog]));
  const [pick, setPick] = useState<{ product: PosProduct; price: string; qty: string; save: boolean } | null>(null);
  const openPick = (p: PosProduct) => setPick({ product: p, price: p.price > 0 ? String(p.price) : '', qty: '1', save: true });
  const confirmPick = async () => {
    if (!pick) return;
    const price = Number(pick.price); const qty = Number(pick.qty);
    if (!(price > 0) || !(qty > 0)) return toast({ title: 'Prix et quantité requis', variant: 'destructive' });
    addToCart(pick.product.name, price, qty);
    if (pick.save && price !== pick.product.price) {
      const ids = new Set(stocks.map(s => s.id));
      for (const id of pick.product.codes.filter(c => ids.has(c))) await updateStock(id, { sale_price: price } as any);
    }
    setPick(null);
  };

  const filtered = catalog.filter((p) => normalizeProductSearch(p.name).includes(normalizeProductSearch(search)) || p.codes.some(c => c.toLowerCase() === search.trim().toLowerCase()));
  const noPrice = catalog.filter(p => !(p.price > 0)).length;
  const photoStatus = (productImages.generating || productImages.error || noPrice > 0) ? (
    <div className="space-y-1 rounded-lg border border-dashed border-border p-2 text-xs text-muted-foreground">
      {productImages.generating && <p className="flex items-center gap-1"><Sparkles className="h-3 w-3" />Création automatique des photos produits… {productImages.missing} restante(s).</p>}
      {!productImages.generating && productImages.error && <p className="text-destructive">Photos : {productImages.error}</p>}
      {noPrice > 0 && <p className="text-destructive">{noPrice} produit(s) sans prix de vente : touchez-les pour saisir le prix.</p>}
    </div>
  ) : null;
  const searchResults = search.trim() ? (
    <div className="divide-y divide-border rounded-lg border border-border">
      {filtered.slice(0, 12).map(p => {
        const img = productImages.imageFor(p.name);
        return (
          <button key={p.key} type="button" onClick={() => view === 'ai' ? (addToCart(p.name, p.price), toast({ title: `${p.name} ajouté` })) : openPick(p)} className="flex w-full items-center gap-3 p-2 text-left hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {img ? <img src={img} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">{p.name.slice(0, 2).toUpperCase()}</span>}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
            <span className={`text-sm font-bold ${p.price > 0 ? 'text-primary' : 'text-destructive'}`}>{p.price > 0 ? formatCurrency(p.price) : 'Sans prix'}</span>
          </button>
        );
      })}
      {!filtered.length && <p className="p-3 text-sm text-muted-foreground">Aucun produit trouvé.</p>}
    </div>
  ) : <p className="text-xs text-muted-foreground">Tapez le nom ou le code d’un produit : il s’affiche aussitôt.</p>;
  const total = calculatePosTotal(cart);
  const sessionSales = cash.movements.filter((m) => m.type === 'sale');
  const sessionTotal = sessionSales.reduce((s, m) => s + m.amount, 0);
  const summary = summarizeSession(Number(cash.session?.opening_amount) || 0, cash.movements);

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
    if (!pendingPayment?.sale) {
      const regName = cash.sessions.find(s => s.id === sessionId)?.name || cash.session?.name;
      if (!(await hasRegisterAccount(activeUnit.id, regName, payment))) {
        const bank = paymentDestination(payment) === 'bank';
        const f = bank
          ? { title: 'Aucun compte bancaire en trésorerie', description: `Pour un paiement « ${payment} », créez d’abord dans Comptabilité › Trésorerie un compte bancaire rattaché à l’unité ${activeUnit.name}. La vente n’a pas été enregistrée.` }
          : { title: 'Aucune caisse en trésorerie', description: `Pour encaisser, créez d’abord dans Comptabilité › Trésorerie un compte « Caisse de vente » rattaché à l’unité ${activeUnit.name}. La vente n’a pas été enregistrée.` };
        setCheckoutError(f); toast({ ...f, variant: 'destructive' });
        return;
      }
    }
    const sale = pendingPayment?.sale || await addSale({
      clientRequestId: requestKey.current,
      date: new Date().toISOString().split('T')[0],
      clientName: client.trim() || 'Client comptoir',
      clientContact: contact.trim(),
      unitId: activeUnit.id,
      products: cart.map(({ pack, ...l }) => ({ ...l, name: pack && pack.size > 1 ? `${l.name} (${Math.round((l.quantity / pack.size) * 100) / 100} ${pack.label} de ${pack.size})` : l.name, total: l.quantity * l.unitPrice })),
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
    try {
      const sessionName = cash.sessions.find(s => s.id === sessionId)?.name || cash.session?.name;
      const t = await postSaleToTreasury(activeUnit.id, sale, sessionName);
      if (t.status === 'no_account') toast({ title: 'Trésorerie non alimentée', description: paymentDestination(sale.paymentMethod || payment) === 'bank' ? 'Créez dans Trésorerie un compte bancaire pour cette unité.' : 'Créez dans Trésorerie un compte « Caisse de vente » portant le nom de cette caisse.', variant: 'destructive' });
      else treasury.reload?.();
    } catch (e: any) {
      toast({ title: 'Vente encaissée, trésorerie à régulariser', description: e.message, variant: 'destructive' });
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
    if (tickets.length > 1) removeTicket();
    } catch (error) {
      reportFailure('Encaissement interrompu', error);
    } finally { setBusy(false); paymentLock.current = false; }
  };

  if (!activeUnit) return (
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

  const doTransfer = async () => {
    const amount = Number(transferAmount) || 0;
    if (amount > cash.expected) { toast({ title: 'Transfert impossible', description: 'Montant supérieur aux espèces disponibles.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      if (transferTarget.startsWith('cash:')) {
        const r = await cash.transferTo(transferTarget.slice(5), amount);
        if (r.error) throw new Error(r.error);
      } else {
        // Remise au comptable / à une personne : simple historique, la trésorerie n'est pas créditée
        // (les ventes y sont déjà inscrites au moment de l'encaissement).
        const out = await cash.addMovement({ type: 'cash_out', amount, label: `Transfert — remise à ${transferPerson.trim()}` });
        if (out.error) throw new Error(out.error);
      }
      setTransferAmount(''); setTransferTarget(''); setTransferPerson('');
      toast({ title: 'Transfert enregistré' });
    } catch (e: any) { toast({ title: 'Transfert incomplet', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const switchTicket = (id: number) => {
    if (id === activeTicket) return;
    const next = tickets.find((t) => t.id === id);
    setTickets((ts) => ts.map((t) => (t.id === activeTicket ? { ...t, cart, client } : t)));
    setCart(next?.cart || []); setClient(next?.client || ''); setActiveTicket(id);
  };
  const addTicket = () => {
    const id = Math.max(...tickets.map((t) => t.id)) + 1;
    setTickets((ts) => [...ts.map((t) => (t.id === activeTicket ? { ...t, cart, client } : t)), { id, cart: [], client: '' }]);
    setCart([]); setClient(''); setActiveTicket(id);
  };
  const removeTicket = () => {
    const rest = tickets.filter((t) => t.id !== activeTicket);
    if (!rest.length) { setCart([]); setClient(''); return; }
    setTickets(rest); setCart(rest[0].cart); setClient(rest[0].client); setActiveTicket(rest[0].id);
  };
  const todayKey = new Date().toDateString();
  const todayMoves = cash.movements.filter((m) => new Date(m.created_at).toDateString() === todayKey);
  const today = summarizeSession(0, todayMoves);
  const checkDayCount = async () => {
    const diff = cashDifference(Number(dayCount) || 0, cash.expected);
    if (diff !== 0 && unitOwner !== undefined) {
      await (appSupabase as any).from('notifications').insert({ user_id: unitOwner || user?.id, type: 'cash_count', module: 'sales', is_critical: true,
        title: `Écart au comptage — ${cash.session?.name || 'Caisse'}`, message: `${diff > 0 ? 'Excédent' : 'Manquant'} de ${Math.abs(diff)} · théorique ${cash.expected} · compté ${Number(dayCount) || 0}`,
        metadata: { session_id: cash.session?.id, unit_id: activeUnit?.id, counted_by: user?.id, expected: cash.expected, counted: Number(dayCount) || 0, difference: diff } });
    }
    toast(diff === 0 ? { title: 'Comptage conforme' } : { title: 'Écart constaté', description: `${formatCurrency(diff)} — l’administrateur est notifié.`, variant: 'destructive' });
    setDayCount('');
  };
  const carried = carriedOverBalance(cash.history, registerName);
  const openNames = new Set(cash.sessions.map((x) => (x.name || '').trim().toLowerCase()));
  const disabledNames = new Set(cash.history.filter((h) => (h as any).notes === 'caisse désactivée').map((h) => (h.name || '').trim().toLowerCase()));
  const closedRegisters = Array.from(new Map(cash.history.filter((h) => h.name && !openNames.has(h.name.trim().toLowerCase()) && !disabledNames.has(h.name.trim().toLowerCase())).map((h) => [h.name!.trim().toLowerCase(), h])).values());
  const reopen = async (name: string) => {
    setBusy(true);
    try {
      const r = await cash.openSession(carriedOverBalance(cash.history, name) ?? 0, name);
      if (r.error) toast({ title: 'Ouverture impossible', description: r.error, variant: 'destructive' });
      else toast({ title: 'Caisse rouverte', description: 'Le solde de la dernière clôture est repris.' });
    } finally { setBusy(false); }
  };
  const reopenList = closedRegisters.length > 0 && <div className="space-y-2">
    <p className="text-xs font-semibold text-muted-foreground">Caisses fermées — rouvrir avec leur solde</p>
    {closedRegisters.map((h) => (
      <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
        <span className="min-w-0 truncate">{h.name} · {formatCurrency(Number(h.counted_amount) || 0)}</span>
        <div className="flex gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={() => reopen(h.name!)}><RotateCcw className="w-4 h-4 mr-1" />Rouvrir</Button>
        {isAdmin && <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
          const { error } = await (appSupabase as any).from('cash_sessions').update({ notes: 'caisse désactivée' }).eq('id', h.id);
          if (error) toast({ title: 'Désactivation impossible', description: error.message, variant: 'destructive' }); else { toast({ title: 'Caisse désactivée' }); cash.reload(); }
        }}>Désactiver</Button>}</div>
      </div>
    ))}
  </div>;

  const openingForm = <div className="space-y-3">
    <label className="text-sm text-muted-foreground">Nom de la caisse</label>
    <Input aria-label="Nom de la nouvelle caisse" value={registerName} onChange={e => setRegisterName(e.target.value)} />
    <label className="text-sm text-muted-foreground">Fond de caisse (facultatif)</label>
    <Input type="number" min="0" aria-label="Fond de caisse" value={opening} onChange={e => setOpening(e.target.value)} placeholder={carried != null ? String(carried) : '0'} />
    {carried != null && opening === '' && <p className="text-xs text-muted-foreground">Solde repris de la dernière clôture : {formatCurrency(carried)}</p>}
    <Button className="w-full" disabled={busy || !registerName.trim() || Number(opening) < 0} onClick={async () => {
      setBusy(true);
      try {
        const r = await cash.openSession(opening === '' ? (carried ?? 0) : Number(opening) || 0, registerName);
        if (r.error) toast({ title: 'Ouverture impossible', description: r.error, variant: 'destructive' });
        else { setOpening(''); setRegisterName(''); setOpenRegister(false); toast({ title: 'Caisse ouverte' }); }
      } finally { setBusy(false); }
    }}><Unlock className="w-4 h-4 mr-2" />Ouvrir la caisse</Button>
  </div>;

  if (!cash.session) return (
    <div className="space-y-6"><Card className="max-w-md mx-auto rounded-lg">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lock className="w-5 h-5 text-primary" />Ouvrir une caisse — {activeUnit.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {reopenList}
        {isAdmin ? openingForm : !closedRegisters.length && <p className="text-sm text-muted-foreground">Aucune caisse ouverte ne vous est attribuée. Demandez à l’administrateur de vous ajouter comme caissier.</p>}
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
      <div className="rounded-xl bg-blue-700 text-white p-3 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">● Ouverte</span>
          <div className="ml-auto flex flex-wrap gap-1">
            {isAdmin && <CashierAssignDialog sessionId={cash.session.id} current={(cash.session as any).cashier_ids || []} onSaved={() => cash.reload()} />}
            <Button variant="registerAction" size="sm" onClick={() => setOpsOpen(true)}><MoreHorizontal className="h-4 w-4" />Opérations</Button>
            <Button variant="registerAction" size="sm" disabled={busy || !!pendingPayment} onClick={() => setCloseOpen(true)}><Lock className="h-4 w-4" />Clôturer</Button>
            <Button variant="registerAction" size="sm" onClick={() => setLockAsk(true)} aria-label="Verrouiller la caisse" title="Verrouiller : protège la caisse par votre mot de passe pendant une absence"><KeyRound className="h-4 w-4" />Verrouiller</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="rounded-lg bg-white/15 p-2 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-blue-100">Caisse</p>
            {cash.sessions.length > 1 ? (
              <select className="mt-0.5 w-full h-7 rounded bg-white text-blue-900 px-1 text-sm font-semibold" value={cash.session.id} disabled={busy || !!pendingPayment} onChange={(e) => cash.setActiveSession(e.target.value)} aria-label="Choisir la caisse">
                {cash.sessions.map((s) => <option key={s.id} value={s.id}>{s.name || 'Caisse'}</option>)}
              </select>
            ) : <p className="font-bold truncate">{cash.session.name || 'Caisse principale'}</p>}
          </div>
          <div className="rounded-lg bg-white/15 p-2 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-blue-100">Caissier</p>
            <p className="font-bold truncate">{(user as any)?.user_metadata?.full_name || [(user as any)?.user_metadata?.first_name, (user as any)?.user_metadata?.last_name].filter(Boolean).join(' ') || user?.email || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/15 p-2"><p className="text-[11px] uppercase tracking-wide text-blue-100">Ventes du jour</p><p className="font-bold">{formatCurrency(today.sales)}</p></div>
          <div className="rounded-lg bg-white/15 p-2"><p className="text-[11px] uppercase tracking-wide text-blue-100">Tickets du jour</p><p className="font-bold">{todayMoves.filter(m => m.type === 'sale').length}</p></div>
          <div className="rounded-lg bg-white/15 p-2 col-span-2 sm:col-span-1"><p className="text-[11px] uppercase tracking-wide text-blue-100">Solde en caisse</p><p className="font-bold">{formatCurrency(cash.expected)}</p></div>
        </div>
        {closedRegisters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-blue-100">Caisses fermées :</span>
            {closedRegisters.map((h) => (
              <button key={h.id} disabled={busy} onClick={() => reopen(h.name!)} className="rounded-full bg-white/90 px-2 py-0.5 font-medium text-blue-900 hover:bg-white" title="Rouvrir avec le solde de la dernière clôture">
                {h.name} · {formatCurrency(Number(h.counted_amount) || 0)} ↺
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={opsOpen} onOpenChange={setOpsOpen}><DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Opérations de caisse</DialogTitle></DialogHeader>
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
            <p className="text-sm font-semibold">Transférer les fonds</p>
            <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} aria-label="Destination">
              <option value="">Destination…</option>
              {cash.sessions.filter((s) => s.id !== cash.session?.id).map((s) => <option key={s.id} value={`cash:${s.id}`}>Caisse · {s.name || 'Caisse'}</option>)}
              <option value="person">Remise au comptable ou à une personne</option>
            </select>
            {transferTarget === 'person' && <Input placeholder="Nom et fonction du bénéficiaire" value={transferPerson} onChange={(e) => setTransferPerson(e.target.value)} />}
            <div className="flex gap-2">
              <Input type="number" placeholder="Montant" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
              <Button size="sm" variant="outline" className="h-10" onClick={() => setTransferAmount(String(Math.max(0, cash.expected)))}>Tout</Button>
            </div>
            <p className="text-xs text-muted-foreground">Espèces disponibles : {formatCurrency(cash.expected)}</p>
            <Button size="sm" className="w-full" disabled={busy || !transferTarget || !(Number(transferAmount) > 0) || (transferTarget === 'person' && !transferPerson.trim())} onClick={doTransfer}>Transférer</Button>
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
      </DialogContent></Dialog>
      <Dialog open={closeOpen} onOpenChange={(o) => !busy && setCloseOpen(o)}><DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Clôturer « {cash.session.name || 'Caisse'} »</DialogTitle></DialogHeader>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm text-muted-foreground">1. Facultatif : transférez les fonds avant la clôture. Sinon ils restent dans la caisse et seront repris demain.</p>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Transférer les fonds</p>
            <select className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} aria-label="Destination">
              <option value="">Destination…</option>
              {cash.sessions.filter((s) => s.id !== cash.session?.id).map((s) => <option key={s.id} value={`cash:${s.id}`}>Caisse · {s.name || 'Caisse'}</option>)}
              <option value="person">Remise au comptable ou à une personne</option>
            </select>
            {transferTarget === 'person' && <Input placeholder="Nom et fonction du bénéficiaire" value={transferPerson} onChange={(e) => setTransferPerson(e.target.value)} />}
            <div className="flex gap-2">
              <Input type="number" placeholder="Montant" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
              <Button size="sm" variant="outline" className="h-10" onClick={() => setTransferAmount(String(Math.max(0, cash.expected)))}>Tout</Button>
            </div>
            <p className="text-xs text-muted-foreground">Espèces disponibles : {formatCurrency(cash.expected)}</p>
            <Button size="sm" className="w-full" disabled={busy || !transferTarget || !(Number(transferAmount) > 0) || (transferTarget === 'person' && !transferPerson.trim())} onClick={doTransfer}>Transférer</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">2. Comptez les espèces présentes puis clôturez.</p>
          <Card className="rounded-xl"><CardContent className="p-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Bilan de la caisse « {cash.session.name || 'Caisse'} »</p>
            {([['Solde d’ouverture', summary.opening], ['Ventes (tous paiements)', summary.sales],
              ...Object.entries(summary.salesByPayment).map(([k, v]) => [`  dont ${k}`, v] as [string, number]),
              ['Entrées d’espèces', summary.cashIn], ['Sorties / dépenses', -summary.cashOut],
              ['Transferts entrants', summary.transfersIn], ['Transferts sortants', -summary.transfersOut]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex justify-between text-muted-foreground"><span className="whitespace-pre">{k}</span><span>{formatCurrency(v)}</span></div>
            ))}
            <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Solde théorique (espèces)</span><span>{formatCurrency(summary.expected)}</span></div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Clôturer la journée</p>
            <Input type="number" placeholder="Montant physique compté" value={counted} onChange={(e) => setCounted(e.target.value)} />
            {counted !== '' && (() => { const d = cashDifference(Number(counted) || 0, summary.expected); return (
              <p className={`text-xs ${d === 0 ? 'text-primary' : 'text-destructive'}`}>{d === 0 ? 'Caisse équilibrée.' : `Écart ${d > 0 ? 'positif' : 'négatif'} : ${formatCurrency(d)} — il sera enregistré et signalé au responsable.`}</p>
            ); })()}
            <p className="text-xs text-muted-foreground">Le montant compté reste dans la caisse et sera repris à la prochaine ouverture.</p>
            <Button variant="destructive" size="sm" className="w-full" disabled={counted === '' || busy || !!pendingPayment} onClick={async () => {
              const r: any = await cash.closeSession(Number(counted) || 0);
              if (r.error) toast({ title: 'Clôture impossible', description: r.error, variant: 'destructive' });
              else { setCounted(''); setCloseOpen(false); toast(r.difference ? { title: 'Caisse fermée avec écart', description: `Écart de ${formatCurrency(r.difference)} enregistré et notifié.`, variant: 'destructive' } : { title: 'Clôture équilibrée' }); }
            }}><Lock className="w-4 h-4 mr-1" />Clôturer</Button>
          </div>
          </CardContent></Card>
      </DialogContent></Dialog>
      <Dialog open={locked} onOpenChange={() => {}}><DialogContent className="max-w-sm [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Caisse verrouillée</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Le panier et les ventes enregistrées sont conservés. Saisissez le mot de passe de votre compte pour reprendre.</p>
        <Input type="password" aria-label="Mot de passe" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} />
        {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
        <Button onClick={unlock} disabled={!unlockPassword}><Unlock className="w-4 h-4 mr-2" />Déverrouiller</Button>
        <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'dashboard' }))}>Quitter la caisse</Button>
      </DialogContent></Dialog>
      <Dialog open={lockAsk} onOpenChange={setLockAsk}><DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />Verrouiller la caisse ?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Pendant votre absence, personne ne peut vendre ni voir la caisse. Le panier est conservé. Votre mot de passe sera demandé pour reprendre.</p>
        <div className="flex gap-2"><Button className="flex-1" onClick={() => { setLockAsk(false); setLocked(true); }}><Lock className="w-4 h-4 mr-2" />Verrouiller</Button><Button variant="outline" className="flex-1" onClick={() => setLockAsk(false)}>Annuler</Button></div>
      </DialogContent></Dialog>

      {checkoutError && <Alert variant="destructive"><AlertDescription><p className="font-semibold">{checkoutError.title}</p><p>{checkoutError.description}</p>{pendingPayment && <p className="mt-2">Vente : {pendingPayment.sale.documentNumber || pendingPayment.sale.id} · Montant : {formatCurrency(pendingPayment.sale.totalAmount)} · Caisse : {cash.sessions.find(s => s.id === pendingPayment.sessionId)?.name || pendingPayment.sessionId}</p>}</AlertDescription></Alert>}
      {pendingPayment && <Alert><AlertDescription>La vente est enregistrée. Reprenez l’encaissement pour mettre à jour sa caisse, sans recréer la vente.</AlertDescription></Alert>}

      {view === 'registers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Caisses de l’unité</h3>{isAdmin && <Button size="sm" onClick={() => setOpenRegister(true)}><Plus className="h-4 w-4 mr-1" />Nouvelle caisse</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cash.sessions.map((s) => (
              <Card key={s.id} className={`rounded-xl ${s.id === cash.session?.id ? 'border-primary' : ''}`}>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold truncate">{s.name || 'Caisse'}</span><Badge>Ouverte</Badge></div>
                  <div className="flex justify-between text-muted-foreground"><span>Ouverte le</span><span>{new Date(s.opened_at).toLocaleString('fr-FR')}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Caissier(s) affecté(s)</span><span>{((s as any).cashier_ids || []).length}</span></div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => { cash.setActiveSession(s.id); onNavigate?.('checkout'); }}>Accéder à la caisse</Button>
                    {isAdmin && <CashierAssignDialog sessionId={s.id} current={(s as any).cashier_ids || []} onSaved={() => cash.reload()} />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {reopenList}
          {isAdmin && <CashDiscrepancies history={cash.history} formatCurrency={formatCurrency} unitId={activeUnit.id} />}
          <h3 className="font-semibold text-sm">Historique des ventes en caisse</h3>
          <CashSalesHistory key={activeUnit.id} sessions={[...cash.sessions, ...cash.history]} movements={cash.allMovements} sales={sales} activeSessionId={cash.session.id} />
        </div>
      )}
      {(view === 'checkout' || view === 'ai' || view === 'multi') && (<>
      {catalog.length === 0 && (
        <Card className="rounded-xl border-primary/40 bg-primary/5"><CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Boxes className="w-6 h-6 text-primary" />
          <div className="flex-1 min-w-0"><p className="font-semibold">Initiez votre stock pour vendre</p><p className="text-sm text-muted-foreground">Ajoutez vos produits en « Stock commercial » avec leur prix de vente : ils apparaîtront ici.</p></div>
          <Button onClick={() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'stock' }))}>Initier le stock</Button>
        </CardContent></Card>
      )}
      {(view === 'multi' || tickets.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {tickets.map((t, i) => (
            <Button key={t.id} size="sm" variant={t.id === activeTicket ? 'default' : 'outline'} disabled={busy || !!pendingPayment} onClick={() => switchTicket(t.id)}>
              Client {i + 1}{(t.id === activeTicket ? cart : t.cart).length ? ` · ${(t.id === activeTicket ? cart : t.cart).length}` : ''}
            </Button>
          ))}
          <Button size="sm" variant="secondary" disabled={busy || !!pendingPayment || tickets.length >= 6} onClick={addTicket}><Plus className="w-4 h-4 mr-1" />Nouveau client</Button>
          {tickets.length > 1 && <Button size="sm" variant="ghost" disabled={busy || !!pendingPayment} onClick={removeTicket}><Trash2 className="w-4 h-4 mr-1" />Fermer ce ticket</Button>}
        </div>
      )}
      <fieldset disabled={busy || !!pendingPayment} className="min-w-0 space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        {view !== 'ai' ? (
        <Card className="rounded-2xl">
          <CardContent className="p-3 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Rechercher un produit ou un code" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filtered.length === 1) addToCart(filtered[0].name, filtered[0].price); }} />
              <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scanner un code"><ScanLine className="w-4 h-4" /></Button>
            </div>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucun stock commercial disponible. Dans Stock, ajoutez ou modifiez un article en choisissant « Stock commercial » avec son prix de vente.</p>
            ) : view === 'multi' ? (
              searchResults
            ) : (
              <>
              {photoStatus}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((p) => {
                  const initials = p.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
                  const img = productImages.imageFor(p.name);
                  return (
                  <button key={p.key} type="button" onClick={() => openPick(p)}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:border-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="relative aspect-[4/3] w-full bg-muted">
                      {img ? <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center bg-primary/10 text-primary" aria-hidden><span className="text-2xl font-bold">{productImages.generating ? '…' : initials || '?'}</span></div>}
                      <span className={`absolute bottom-1 right-1 rounded-md px-2 py-0.5 text-xs font-bold shadow ${p.price > 0 ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                        {p.price > 0 ? formatCurrency(p.price) : 'Sans prix'}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-2">
                      <span className="line-clamp-2 min-h-[2.5rem] break-words text-sm font-semibold leading-tight text-foreground" title={p.name}>{p.name}</span>
                      {p.quantity !== undefined && <span className="text-xs text-muted-foreground">Stock : {p.quantity} {p.unit}</span>}
                    </div>
                  </button>
                  );
                })}
              </div>
              </>
            )}
            {catalog.length > 0 && view !== 'multi' && !filtered.length && <p className="text-sm text-muted-foreground">Aucun produit trouvé.</p>}
            <Dialog open={!!pick} onOpenChange={o => { if (!o) setPick(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="break-words">{pick?.product.name}</DialogTitle></DialogHeader>
                {pick && (
                  <form className="space-y-3" onSubmit={e => { e.preventDefault(); confirmPick(); }}>
                    {productImages.imageFor(pick.product.name) && <img src={productImages.imageFor(pick.product.name)} alt={pick.product.name} className="aspect-[4/3] w-full rounded-lg object-cover" />}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">Prix de vente
                        <Input autoFocus type="number" min="0" step="any" inputMode="decimal" placeholder="Saisir le prix" className="mt-1 text-right font-semibold" value={pick.price} onFocus={e => e.target.select()} onChange={e => setPick({ ...pick, price: e.target.value })} />
                      </label>
                      <label className="text-xs text-muted-foreground">Quantité{pick.product.unit ? ` (${pick.product.unit})` : ''}
                        <Input type="number" min="0" step="any" inputMode="decimal" className="mt-1 text-right" value={pick.qty} onFocus={e => e.target.select()} onChange={e => setPick({ ...pick, qty: e.target.value })} />
                      </label>
                    </div>
                    <p className="text-sm">Total : <b className="text-primary">{formatCurrency((Number(pick.price) || 0) * (Number(pick.qty) || 0))}</b></p>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={pick.save} onChange={e => setPick({ ...pick, save: e.target.checked })} />
                      Enregistrer ce prix pour les prochaines ventes
                    </label>
                    <Button type="submit" className="w-full"><ShoppingCart className="h-4 w-4 mr-2" />Ajouter au panier</Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => setCart(prev => [...prev, { name: search.trim(), quantity: 1, unitPrice: 0 }])}><Plus className="h-4 w-4 mr-2" />Ajouter un produit</Button>
          </CardContent>
        </Card>
        ) : (
        <div className="space-y-3">
        <Card className="rounded-2xl"><CardContent className="p-3 space-y-2">
          <p className="text-sm font-semibold">Rechercher un produit</p>
          <Input placeholder="Nom ou code du produit" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchResults}
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 space-y-2">
          <p className="text-sm font-semibold">Vente par la voix ou par texte</p>
            <div className="flex gap-2">
              <Input placeholder="Dites ou tapez : 5 kg tilapia, 2 silure à Kossi" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuick()} />
              <Button variant="outline" onClick={startVoice} disabled={listening} aria-label="Dicter la vente"><Mic className={`w-4 h-4 ${listening ? 'text-destructive animate-pulse' : ''}`} /></Button>
              <Button variant="secondary" onClick={() => handleQuick()}><Sparkles className="w-4 h-4 mr-1" />Ajouter</Button>
            </div>
        </CardContent></Card>
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

        </div>
        )}
        <Card id="pos-cart" className="rounded-2xl lg:sticky lg:top-4 lg:self-start">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Panier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Touchez un produit pour l'ajouter.</p>}
            {cart.map((l, i) => (
              <div key={i} className={`space-y-2 rounded-lg border-l-4 p-2 odd:bg-primary/5 even:bg-accent/40 ${l.unitPrice > 0 ? 'border-primary' : 'border-destructive'}`}>
                <div className="flex items-center gap-2">
                  <Input aria-label={`Produit ${i + 1}`} className="h-8 flex-1 font-medium" value={l.name} onChange={e => updateLine(i, { name: e.target.value })} />
                  <Button size="icon" variant="ghost" aria-label={`Retirer le produit ${i + 1}`} className="h-8 w-8 shrink-0" onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr_auto] items-end gap-2">
                  <div>
                    <span className="block text-xs text-muted-foreground">Quantité</span>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" aria-label={`Diminuer la quantité ${i + 1}`} className="h-8 w-8" disabled={l.quantity <= 1} onClick={() => updateLine(i, { quantity: l.quantity - 1 })}><Minus className="w-3 h-3" /></Button>
                      <Input aria-label={`Quantité ${i + 1}`} min="0" step="any" type="number" className="h-8 w-14 text-center text-sm" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
                      <Button size="icon" variant="outline" aria-label={`Augmenter la quantité ${i + 1}`} className="h-8 w-8" onClick={() => updateLine(i, { quantity: l.quantity + 1 })}><Plus className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <label className="block min-w-0 text-xs text-muted-foreground">Prix unitaire
                    <Input aria-label={`Prix unitaire ${i + 1}`} min="0" step="any" type="number" inputMode="decimal" placeholder="Saisir le prix"
                      className={`h-8 mt-0.5 text-right font-semibold ${l.unitPrice > 0 ? '' : 'border-destructive'}`}
                      value={l.unitPrice > 0 ? l.unitPrice : ''} onFocus={e => e.target.select()}
                      onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })} />
                  </label>
                  <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:block sm:text-right">
                    <span className="block text-xs text-muted-foreground">Total</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(l.quantity * l.unitPrice)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Conditionnement</span>
                  <select aria-label={`Conditionnement ${i + 1}`} className="h-8 rounded-md border border-border bg-background px-2" value={l.pack?.label || 'unité'}
                    onChange={(e) => { const label = e.target.value; const size = label === 'unité' ? 1 : (l.pack?.size && l.pack.size > 1 ? l.pack.size : label === 'pack' ? 6 : 12); updateLine(i, { pack: label === 'unité' ? undefined : { label, size }, quantity: size }); }}>
                    <option value="unité">Unité</option><option value="pack">Pack</option><option value="carton">Carton</option>
                  </select>
                  {l.pack && <>
                    <label className="flex items-center gap-1">de<Input aria-label={`Unités par ${l.pack.label} ${i + 1}`} type="number" min="1" className="h-8 w-16" value={l.pack.size} onChange={(e) => { const size = Math.max(1, Number(e.target.value) || 1); const packs = l.quantity / l.pack!.size; updateLine(i, { pack: { ...l.pack!, size }, quantity: packs * size }); }} />unités</label>
                    <label className="flex items-center gap-1">Nombre<Input aria-label={`Nombre de ${l.pack.label} ${i + 1}`} type="number" min="0" step="any" className="h-8 w-16" value={l.quantity / l.pack.size} onChange={(e) => updateLine(i, { quantity: (Number(e.target.value) || 0) * l.pack!.size })} /></label>
                    <span>= {l.quantity} unités</span>
                  </>}
                </div>
              </div>
            ))}
            <div className="relative">
              <Input placeholder="Nom du client (facultatif)" value={client} onChange={(e) => { setClient(e.target.value); setClientOpen(true); }} onFocus={() => setClientOpen(true)} onBlur={() => window.setTimeout(() => setClientOpen(false), 150)} />
              {clientOpen && clientMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                  {clientMatches.map(c => (
                    <button key={c.name + c.contact} type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={e => e.preventDefault()} onClick={() => { setClient(c.name); setContact(c.contact); setClientOpen(false); }}>
                      <span className="truncate font-medium">{c.name}</span><span className="shrink-0 text-xs text-muted-foreground">{c.contact}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input placeholder="Téléphone ou email du client (facultatif)" value={contact} onChange={e => setContact(e.target.value)} />
            <p className="text-xs text-muted-foreground">Le client est enregistré avec la vente et retrouvé à la prochaine saisie de son nom.</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENTS.map((p) => (
                <Button key={p} size="sm" variant={payment === p ? 'default' : 'outline'} onClick={() => setPayment(p)}>{p}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{paymentDestination(payment) === 'bank' ? 'Encaissé sur le compte banque de l’unité (Trésorerie).' : 'Encaissé dans la caisse de l’unité (Trésorerie).'}</p>
            <div className="flex justify-between gap-2 text-lg font-bold pt-2 border-t border-border"><span>Total</span><span className="text-right">{formatCurrency(total)}</span></div>
            {!pendingPayment && <Button className="w-full h-12 text-base" disabled={busy || !isValidPosCart(cart)} onClick={checkout}>{busy ? 'Encaissement…' : `Encaisser · ${formatCurrency(total)}`}</Button>}
          </CardContent>
        </Card>
      </div>
      </fieldset>
      {pendingPayment && <Button className="w-full h-12 text-base" disabled={busy} onClick={checkout}>{busy ? 'Encaissement…' : 'Reprendre l’encaissement'}</Button>}

      </>)}


      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Reçu {receipt?.number}</DialogTitle></DialogHeader>
        {receipt && <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{receipt.date} · {receipt.register} · {receipt.client}</p>
          {receipt.lines.map((l, i) => <div key={i} className="flex justify-between border-b border-border py-1"><span>{l.name} × {l.quantity}</span><span>{formatCurrency(l.quantity * l.unitPrice)}</span></div>)}
          <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatCurrency(receipt.total)}</span></div>
          <p className="text-muted-foreground">Paiement : {receipt.payment}</p>
          <Button className="w-full" onClick={printReceipt}><Printer className="w-4 h-4 mr-2" />Imprimer le reçu</Button>
        </div>}
      </DialogContent></Dialog>
      {view !== 'registers' && cart.length > 0 && (
        <Button className="lg:hidden fixed bottom-20 left-4 z-40 h-12 rounded-full shadow-lg" onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth' })}>
          <ShoppingCart className="w-4 h-4 mr-2" />{cart.reduce((n, l) => n + l.quantity, 0)} article(s) · {formatCurrency(total)}
        </Button>
      )}
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
};

export default CashRegisterPOS;

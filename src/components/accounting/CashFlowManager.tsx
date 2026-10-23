import React, { useEffect, useState } from 'react';
import { supabase as appDb } from '@/integrations/supabase/appClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wallet, Landmark, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useTreasury } from '@/hooks/useTreasury';
import { accountBalance, type MovementKind } from '@/lib/treasury';
import { CHART } from '@/lib/syscohada';
import { formatMoney, type CurrencyCode } from '@/lib/currency';

const names: Record<MovementKind, string> = { opening: 'Fonds initiaux', receipt: 'Encaissement', payment: 'Décaissement', transfer: 'Transfert' };
const ACCOUNT_TYPES = [
  { id: 'caisse', label: 'Caisse', kind: 'cash', prefix: '571' },
  { id: 'caisse_vente', label: 'Caisse de vente', kind: 'cash', prefix: '571' },
  { id: 'coffre', label: 'Caisse centrale / coffre', kind: 'cash', prefix: '571' },
  { id: 'mobile', label: 'Mobile Money', kind: 'bank', prefix: '552' },
  { id: 'banque', label: 'Compte bancaire', kind: 'bank', prefix: '521' },
] as const;
const EXPENSES = [
  { label: 'Carburant', code: '605' }, { label: 'Eau et électricité', code: '605' }, { label: 'Aliments et alevins', code: '602' },
  { label: 'Fournitures et petit matériel', code: '604' }, { label: 'Transport et déplacements', code: '638' }, { label: 'Loyer', code: '622' },
  { label: 'Entretien et réparations', code: '624' }, { label: 'Téléphone et internet', code: '628' }, { label: 'Salaires', code: '661' },
  { label: 'Impôts et taxes', code: '641' }, { label: 'Frais bancaires', code: '631' }, { label: 'Autres dépenses', code: '638' },
];
const today = () => new Date().toISOString().slice(0, 10);
const CashFlowManager = () => {
  const { activeUnit, units } = useProductionUnits();
  const [registerNames, setRegisterNames] = useState<string[]>([]);
  const [registerUnit, setRegisterUnit] = useState('');
  useEffect(() => {
    if (!registerUnit) { setRegisterNames([]); return; }
    (appDb as any).from('cash_sessions').select('name').eq('unit_id', registerUnit).then(({ data }: any) =>
      setRegisterNames([...new Set<string>((data || []).map((r: any) => r.name).filter(Boolean))]));
  }, [registerUnit]);
  const { currency } = useSettings();
  const treasury = useTreasury(activeUnit?.id);
  const [accountOpen, setAccountOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState({ unitId: '', name: '', type: 'caisse', kind: 'cash' as 'cash' | 'bank', code: '', opening: '', counterpart: '101', date: today() });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expense, setExpense] = useState({ requestId: '', category: EXPENSES[0].label, sourceId: '', amount: '', date: today(), note: '' });
  const [movement, setMovement] = useState({ requestId: '', kind: 'receipt' as MovementKind, sourceId: '', destinationId: '', amount: '', date: today(), label: '', counterpart: '' });
  const money = (amount: number, code: string = currency) => formatMoney(amount, code as CurrencyCode);
  const openMovement = (kind: MovementKind) => {
    setMovement({ requestId: crypto.randomUUID(), kind, sourceId: '', destinationId: '', amount: '', date: today(), label: '', counterpart: '' });
    setMovementOpen(true);
  };
  useEffect(() => { setRegisterUnit(account.unitId); }, [account.unitId]);
  const saveAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { type, ...rest } = account;
      await treasury.createAccount({ ...rest, name: rest.name.trim() || ACCOUNT_TYPES.find(t => t.id === type)!.label, currency, opening: Number(account.opening || 0) });
      setAccountOpen(false); toast.success(`Compte enregistré pour ${units.find(u => u.id === account.unitId)?.name || 'l’unité'}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const generateCode = (prefix: string) => {
    const used = new Set(treasury.accounts.map(a => a.account_code));
    for (let i = 1; i < 1000; i++) { const c = `${prefix}${i}`; if (!used.has(c)) return c; }
    return prefix;
  };
  const saveExpense = async () => {
    if (busy) return;
    const cat = EXPENSES.find(e => e.label === expense.category)!;
    setBusy(true);
    try {
      await treasury.recordMovement({ requestId: expense.requestId, kind: 'payment', sourceId: expense.sourceId, destinationId: '', amount: Number(expense.amount), date: expense.date, label: `Dépense — ${cat.label}${expense.note.trim() ? ` · ${expense.note.trim()}` : ''}`, counterpart: cat.code });
      setExpenseOpen(false); toast.success('Dépense et écriture enregistrées');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const saveMovement = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await treasury.recordMovement({ ...movement, amount: Number(movement.amount) });
      setMovementOpen(false); toast.success('Mouvement et écriture enregistrés');
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const accountSelect = (value: string, onChange: (v: string) => void, id: string) => <Select value={value} onValueChange={onChange}><SelectTrigger id={id}><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{treasury.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} · {money(accountBalance(a.id, treasury.movements), a.currency)}</SelectItem>)}</SelectContent></Select>;
  const counterpart = (value: string, onChange: (v: string) => void, id: string) => <div><Label htmlFor={id}>Compte de contrepartie</Label><Input id={id} list="treasury-counterparts" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">{CHART[value] || '—'}</p></div>;
  const totals = treasury.accounts.reduce<Record<string, number>>((out, a) => { out[a.currency] = (out[a.currency] || 0) + accountBalance(a.id, treasury.movements); return out; }, {});
  return <div className="space-y-4 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Trésorerie · {activeUnit?.name}</h3><Button size="icon" variant="outline" aria-label="Actualiser la trésorerie" title="Actualiser" onClick={treasury.reload}><RefreshCw className="h-4 w-4" /></Button></div>
    {treasury.error && <p role="alert" className="text-sm text-destructive border border-destructive rounded-md p-3">{treasury.error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={treasury.loading || !activeUnit} onClick={() => { setAccount({ unitId: activeUnit?.id || '', name: '', type: 'caisse', kind: 'cash', code: generateCode('571'), opening: '', counterpart: '101', date: today() }); setAccountOpen(true); }}><Plus className="h-4 w-4 mr-2" />Créer un compte</Button>{(['receipt', 'payment', 'transfer'] as const).map(kind => <Button key={kind} variant="outline" disabled={!treasury.accounts.length || !!treasury.error} onClick={() => openMovement(kind)}>{kind === 'receipt' ? <ArrowDownLeft className="h-4 w-4 mr-2" /> : kind === 'payment' ? <ArrowUpRight className="h-4 w-4 mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}{kind === 'receipt' ? 'Encaisser' : kind === 'payment' ? 'Décaisser' : 'Transférer'}</Button>)}<Button variant="outline" disabled={!treasury.accounts.length || !!treasury.error} onClick={() => { setExpense({ requestId: crypto.randomUUID(), category: EXPENSES[0].label, sourceId: treasury.accounts[0]?.id || '', amount: '', date: today(), note: '' }); setExpenseOpen(true); }}><ArrowUpRight className="h-4 w-4 mr-2" />Dépense</Button></div>
    {Object.entries(totals).map(([code, total]) => <div key={code} className="border-b border-border pb-3"><span className="text-sm text-muted-foreground">Solde total · {code}</span><p className="text-2xl font-semibold">{money(total, code)}</p></div>)}
    {treasury.loading && <p role="status" className="text-muted-foreground">Chargement…</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{treasury.accounts.map(a => <Card key={a.id}><CardContent className="p-4 space-y-2"><div className="flex items-start gap-3">{a.kind === 'cash' ? <Wallet className="h-5 w-5 text-primary shrink-0" /> : <Landmark className="h-5 w-5 text-primary shrink-0" />}<div className="min-w-0"><h4 className="font-semibold break-words">{a.name}</h4><p className="text-xs text-muted-foreground">{a.kind === 'cash' ? 'Caisse' : 'Banque'} · {a.account_code}</p></div></div><p className="text-xl font-semibold break-words">{money(accountBalance(a.id, treasury.movements), a.currency)}</p><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive px-0" onClick={async () => {
      if (Math.abs(accountBalance(a.id, treasury.movements)) > 0.004) { toast.error(`Impossible de supprimer : il y a encore ${money(accountBalance(a.id, treasury.movements), a.currency)} sur ce compte. Transférez ou décaissez d’abord cet argent.`); return; }
      if (!window.confirm(`Attention, opération risquée.\n\nLe compte « ${a.name} » est rattaché à l’unité « ${activeUnit?.name || ''} ». Après suppression, les ventes des caisses de cette unité n’y arriveront plus.\n\nSon historique et ses écritures comptables restent conservés.\n\nSupprimer quand même ?`)) return;
      try { await treasury.archiveAccount(a.id); toast.success('Compte supprimé'); } catch (e: any) { toast.error(e.message); }
    }}><Trash2 className="h-4 w-4 mr-1" />Supprimer</Button>{units.length > 1 && <Select value="" onValueChange={async v => {
      const target = units.find(u => u.id === v);
      if (!window.confirm(`Rattacher le compte « ${a.name} » à l’unité « ${target?.name || ''} » ? Son solde et son historique la suivent.`)) return;
      try { await treasury.reattachAccount(a.id, v); toast.success(`Compte rattaché à ${target?.name || 'l’unité'}`); } catch (e: any) { toast.error(e.message); }
    }}><SelectTrigger className="h-8 text-xs" aria-label="Rattacher à une autre unité"><SelectValue placeholder="Rattacher à une autre unité…" /></SelectTrigger><SelectContent>{units.filter(u => u.id !== a.unit_id).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>}</CardContent></Card>)}</div>
    {!treasury.loading && !treasury.error && !treasury.accounts.length && <div role="alert" className="border border-primary/40 bg-primary/5 rounded-md p-4 text-sm space-y-2"><p className="font-semibold">Aucun compte n’est rattaché à l’unité « {activeUnit?.name} ».</p><p className="text-muted-foreground">Aucun compte n’est créé automatiquement. Créez la caisse et le compte bancaire de cette unité (ou rattachez un compte existant depuis une autre unité) : sans eux, les ventes et les achats ne peuvent pas être enregistrés en trésorerie.</p><Button size="sm" disabled={!activeUnit} onClick={() => { setAccount({ unitId: activeUnit?.id || '', name: '', type: 'caisse', kind: 'cash', code: generateCode('571'), opening: '', counterpart: '101', date: today() }); setAccountOpen(true); }}><Plus className="h-4 w-4 mr-2" />Créer le compte de l’unité</Button></div>}
    <Tabs defaultValue="movements"><TabsList className="w-full sm:w-auto"><TabsTrigger value="movements">Mouvements</TabsTrigger><TabsTrigger value="entries">Écritures comptables</TabsTrigger></TabsList>
      <TabsContent value="movements"><div className="divide-y divide-border">{treasury.movements.map(m => <div key={m.id} className="py-3 flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="font-medium break-words">{m.label}</p><p className="text-xs text-muted-foreground">{m.date} · {names[m.kind]} · {treasury.accounts.find(a => a.id === m.source_id)?.name}{m.kind === 'transfer' ? ' → ' : ''}{treasury.accounts.find(a => a.id === m.destination_id)?.name}</p></div><span className="font-semibold">{money(m.amount, treasury.accounts.find(a => a.id === (m.source_id || m.destination_id))?.currency)}</span></div>)}</div>{!treasury.movements.length && <p className="py-6 text-muted-foreground">Aucun mouvement enregistré.</p>}</TabsContent>
      <TabsContent value="entries"><div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]"><thead><tr className="text-left border-b border-border"><th className="py-2">Date</th><th>Journal / Libellé</th><th>Compte</th><th className="text-right">Débit</th><th className="text-right">Crédit</th></tr></thead><tbody>{treasury.movements.flatMap(m => m.lines.map((l, i) => <tr key={m.id + i} className="border-b border-border"><td className="py-2">{i === 0 ? m.date : ''}</td><td>{i === 0 ? `${m.journal} · ${m.label}` : ''}</td><td>{l.account} {CHART[l.account]}</td><td className="text-right">{l.debit || '—'}</td><td className="text-right">{l.credit || '—'}</td></tr>))}</tbody></table></div></TabsContent>
    </Tabs>
    <datalist id="treasury-counterparts">{Object.entries(CHART).filter(([code]) => !code.startsWith('5')).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</datalist>
    <Dialog open={accountOpen} onOpenChange={v => { if (!busy) setAccountOpen(v); }}><DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Créer un compte</DialogTitle></DialogHeader><div className="space-y-3"><div><Label htmlFor="account-unit">Unité rattachée</Label><Select value={account.unitId} onValueChange={v => setAccount({ ...account, unitId: v })}><SelectTrigger id="account-unit"><SelectValue placeholder="Choisir l’unité" /></SelectTrigger><SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground mt-1">Les ventes et le chiffre d’affaires des caisses de cette unité arrivent dans ce compte.</p></div><div><Label htmlFor="account-name">Nom du compte</Label><Input id="account-name" list="register-names" value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} placeholder={registerNames[0] ? `Ex. ${registerNames[0]}` : 'Ex. Caisse de vente'} /><datalist id="register-names">{registerNames.map(n => <option key={n} value={n} />)}</datalist>{account.type === 'caisse_vente' || account.type === 'caisse' ? <p className="text-xs text-muted-foreground mt-1">Donnez le même nom que la caisse de vente (ou un nom contenant « vente ») pour y recevoir ses ventes en espèces.</p> : null}</div><div><Label htmlFor="account-kind">Type de compte</Label><Select value={account.type} onValueChange={v => { const t = ACCOUNT_TYPES.find(x => x.id === v)!; setAccount({ ...account, type: v, kind: t.kind, code: generateCode(t.prefix) }); }}><SelectTrigger id="account-kind"><SelectValue /></SelectTrigger><SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="account-code">Numéro de compte</Label><div className="flex gap-2"><Input id="account-code" inputMode="numeric" value={account.code} onChange={e => setAccount({ ...account, code: e.target.value.replace(/\D/g, '') })} /><Button type="button" variant="outline" onClick={() => setAccount({ ...account, code: generateCode(ACCOUNT_TYPES.find(t => t.id === account.type)!.prefix) })}>Générer</Button></div><p className="text-xs text-muted-foreground mt-1">Tapez un numéro ou cliquez sur Générer ({ACCOUNT_TYPES.find(t => t.id === account.type)!.prefix}…). {treasury.accounts.some(a => a.account_code === account.code) && <span className="text-destructive">Ce numéro est déjà utilisé.</span>}</p></div><div><Label htmlFor="account-opening">Fonds initiaux ({currency})</Label><Input id="account-opening" type="number" min="0" step="0.01" value={account.opening} onChange={e => setAccount({ ...account, opening: e.target.value })} /></div>{Number(account.opening) > 0 && counterpart(account.counterpart, v => setAccount({ ...account, counterpart: v }), 'opening-counterpart')}<div><Label htmlFor="opening-date">Date d’ouverture</Label><Input id="opening-date" type="date" value={account.date} onChange={e => setAccount({ ...account, date: e.target.value })} /></div><Button className="w-full" disabled={busy || !account.unitId || !/^[1-8][0-9]{2,7}$/.test(account.code) || treasury.accounts.some(a => a.account_code === account.code) || !account.date || (Number(account.opening) > 0 && !account.counterpart)} onClick={saveAccount}>{busy ? 'Enregistrement…' : 'Enregistrer le compte'}</Button></div></DialogContent></Dialog>
    <Dialog open={expenseOpen} onOpenChange={v => { if (!busy) setExpenseOpen(v); }}><DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Enregistrer une dépense</DialogTitle></DialogHeader><div className="space-y-3">
      <div><Label htmlFor="expense-cat">Type de dépense</Label><Select value={expense.category} onValueChange={v => setExpense({ ...expense, category: v })}><SelectTrigger id="expense-cat"><SelectValue /></SelectTrigger><SelectContent>{EXPENSES.map(e => <SelectItem key={e.label} value={e.label}>{e.label} · {e.code}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="expense-source">Payée depuis</Label>{accountSelect(expense.sourceId, v => setExpense({ ...expense, sourceId: v }), 'expense-source')}</div>
      <div><Label htmlFor="expense-amount">Montant</Label><Input id="expense-amount" type="number" min="0.01" step="0.01" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} /></div>
      <div><Label htmlFor="expense-date">Date</Label><Input id="expense-date" type="date" value={expense.date} onChange={e => setExpense({ ...expense, date: e.target.value })} /></div>
      <div><Label htmlFor="expense-note">Détail (facultatif)</Label><Input id="expense-note" value={expense.note} onChange={e => setExpense({ ...expense, note: e.target.value })} placeholder="Ex. 40 L gasoil, véhicule de livraison" /></div>
      <Button className="w-full" disabled={busy || !expense.sourceId || Number(expense.amount) <= 0 || !expense.date} onClick={saveExpense}>{busy ? 'Enregistrement…' : 'Enregistrer la dépense'}</Button>
    </div></DialogContent></Dialog>
    <Dialog open={movementOpen} onOpenChange={v => { if (!busy) setMovementOpen(v); }}><DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{names[movement.kind]}</DialogTitle></DialogHeader><div className="space-y-3">{movement.kind !== 'receipt' && <div><Label htmlFor="movement-source">Compte source</Label>{accountSelect(movement.sourceId, v => setMovement({ ...movement, sourceId: v }), 'movement-source')}</div>}{movement.kind !== 'payment' && <div><Label htmlFor="movement-destination">Compte destinataire</Label>{accountSelect(movement.destinationId, v => setMovement({ ...movement, destinationId: v }), 'movement-destination')}</div>}{movement.kind !== 'transfer' && counterpart(movement.counterpart, v => setMovement({ ...movement, counterpart: v }), 'movement-counterpart')}<div><Label htmlFor="movement-amount">Montant</Label><Input id="movement-amount" type="number" min="0.01" step="0.01" value={movement.amount} onChange={e => setMovement({ ...movement, amount: e.target.value })} /></div><div><Label htmlFor="movement-date">Date</Label><Input id="movement-date" type="date" value={movement.date} onChange={e => setMovement({ ...movement, date: e.target.value })} /></div><div><Label htmlFor="movement-label">Libellé / référence</Label><Input id="movement-label" value={movement.label} onChange={e => setMovement({ ...movement, label: e.target.value })} /></div><Button className="w-full" disabled={busy || !movement.label.trim() || !movement.date || Number(movement.amount) <= 0} onClick={saveMovement}>{busy ? 'Enregistrement…' : 'Enregistrer le mouvement'}</Button></div></DialogContent></Dialog>
  </div>;
};
export default CashFlowManager;

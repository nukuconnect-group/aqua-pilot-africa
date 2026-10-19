import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { CHART, Entry, EntryLine, isBalanced, closingEntry, BalanceRow } from '@/lib/syscohada';
import type { useAccountingLedger } from '@/hooks/useAccountingLedger';

type Ledger = ReturnType<typeof useAccountingLedger>;
const blank = (): EntryLine => ({ account: '', debit: 0, credit: 0 });

export const ManualEntryForm: React.FC<{ ledger: Ledger; f: (n: number) => string }> = ({ ledger, f }) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [journal, setJournal] = useState<'AN' | 'OD'>('AN');
  const [label, setLabel] = useState('Soldes d’ouverture');
  const [lines, setLines] = useState<EntryLine[]>([blank(), blank()]);
  const d = lines.reduce((s, l) => s + (+l.debit || 0), 0), c = lines.reduce((s, l) => s + (+l.credit || 0), 0);
  const set = (i: number, k: keyof EntryLine, v: string) => setLines(lines.map((l, j) => j === i ? { ...l, [k]: k === 'account' ? v : Number(v) || 0 } : l));
  const save = async () => {
    const clean = lines.filter((l) => l.account && (l.debit || l.credit));
    if (!label.trim() || !isBalanced(clean)) return toast.error('L’écriture doit être équilibrée (total débit = total crédit).');
    try { await ledger.addEntry({ date, journal, label, lines: clean }); setLines([blank(), blank()]); toast.success('Écriture enregistrée'); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Nouvelle écriture (ouverture, capital, immobilisations, opérations diverses)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            <select className="border rounded-md px-2 bg-background text-sm" value={journal} onChange={(e) => setJournal(e.target.value as any)}>
              <option value="AN">À-nouveaux (ouverture)</option><option value="OD">Opérations diverses</option>
            </select>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" className="flex-1 min-w-[180px]" />
          </div>
          <datalist id="syscohada-accounts">{Object.entries(CHART).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Input list="syscohada-accounts" placeholder="Compte (ex. 101, 231, 571)" value={l.account} onChange={(e) => set(i, 'account', e.target.value)} />
              <Input type="number" placeholder="Débit" value={l.debit || ''} onChange={(e) => set(i, 'debit', e.target.value)} />
              <Input type="number" placeholder="Crédit" value={l.credit || ''} onChange={(e) => set(i, 'credit', e.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, blank()])}><Plus className="h-4 w-4 mr-1" />Ligne</Button>
            <span className="text-sm">Débit {f(d)} · Crédit {f(c)}</span>
            {isBalanced(lines) ? <Badge>Équilibrée</Badge> : <Badge variant="destructive">Non équilibrée</Badge>}
            <Button size="sm" className="ml-auto" onClick={save}>Enregistrer</Button>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Écritures saisies</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!ledger.manual.length && <p className="text-sm text-muted-foreground">Aucune écriture saisie pour cette unité.</p>}
          {ledger.manual.map((e) => (
            <div key={e.id} className="border rounded-xl p-2 text-sm">
              <div className="flex justify-between items-center"><span className="font-medium">{e.date} · {e.journal} · {e.label}</span>
                {e.journal !== 'CL' && <Button variant="ghost" size="icon" onClick={() => ledger.deleteEntry(e.id).catch((x) => toast.error(x.message))}><Trash2 className="h-4 w-4" /></Button>}
              </div>
              {e.lines.map((l, i) => <div key={i} className="flex justify-between text-muted-foreground"><span>{l.account} {CHART[l.account] || ''}</span><span>{l.debit ? f(l.debit) : ''} {l.credit ? f(l.credit) : ''}</span></div>)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export const MarkingPanel: React.FC<{ ledger: Ledger; entries: Entry[]; f: (n: number) => string }> = ({ ledger, entries, f }) => {
  const [account, setAccount] = useState('411');
  const kind = account.startsWith('52') ? 'rapprochement' : 'lettrage';
  const rows = entries.flatMap((e) => e.lines.filter((l) => l.account === account).map((l) => ({ e, l })));
  const isMarked = (id: string) => ledger.marks.some((m) => m.entry_id === id && m.account === account && m.kind === kind);
  const open = rows.filter((r) => !isMarked(r.e.id)).reduce((s, r) => s + r.l.debit - r.l.credit, 0);
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 justify-between">
        <CardTitle className="text-base">{kind === 'rapprochement' ? 'Rapprochement bancaire' : 'Lettrage'}</CardTitle>
        <select className="border rounded-md px-2 py-1 bg-background text-sm" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="411">411 Clients</option><option value="401">401 Fournisseurs</option>
          <option value="521">521 Banques</option><option value="5212">5212 Mobile Money</option>
        </select>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          {kind === 'rapprochement' ? 'Cochez chaque opération retrouvée sur votre relevé bancaire.' : 'Cochez les factures et règlements qui se correspondent.'} Solde non pointé : <b>{f(Math.abs(open))}</b>
        </p>
        {!rows.length && <p className="text-muted-foreground">Aucune opération sur ce compte pour la période.</p>}
        {rows.map(({ e, l }, i) => (
          <label key={e.id + i} className="flex items-center gap-2 border-b py-1 cursor-pointer">
            <input type="checkbox" checked={isMarked(e.id)} onChange={() => ledger.toggleMark(e.id, account, kind).catch((x) => toast.error(x.message))} />
            <span className="w-24">{e.date}</span><span className="flex-1 truncate">{e.label}</span>
            <span className="w-28 text-right">{l.debit ? f(l.debit) : ''}</span><span className="w-28 text-right">{l.credit ? f(l.credit) : ''}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
};

export const ClosingPanel: React.FC<{ ledger: Ledger; balance: BalanceRow[]; to: string; f: (n: number) => string }> = ({ ledger, balance, to, f }) => {
  const year = Number(to.slice(0, 4));
  const done = ledger.closures.find((c) => c.fiscal_year === year);
  const entry = closingEntry(balance, `${year}-12-31`);
  const result = entry ? (entry.lines.at(-1)!.credit - entry.lines.at(-1)!.debit) : 0;
  const close = async () => {
    if (!entry) return toast.error('Aucun compte de charges ou de produits à solder.');
    if (!confirm(`Clôturer l’exercice ${year} ? Les comptes 6 et 7 seront soldés vers le compte 131.`)) return;
    try { await ledger.closeYear(year, result, entry); toast.success(`Exercice ${year} clôturé`); } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-base">Clôture de l’exercice {year}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {done ? <p><Lock className="inline h-4 w-4 mr-1" />Exercice clôturé le {new Date(done.closed_at).toLocaleDateString('fr-FR')} — résultat {f(done.result)}.</p> : <>
          <p>Résultat de l’exercice à reporter au compte 131 : <b>{f(result)}</b> ({result >= 0 ? 'bénéfice' : 'perte'}).</p>
          <p className="text-muted-foreground">Avant de clôturer : saisissez les soldes d’ouverture, les amortissements (681/28) et pointez la banque. Choisissez la période du 1er janvier au 31 décembre.</p>
          <Button onClick={close} disabled={!entry}><Lock className="h-4 w-4 mr-1" />Clôturer l’exercice</Button></>}
      </CardContent>
    </Card>
  );
};

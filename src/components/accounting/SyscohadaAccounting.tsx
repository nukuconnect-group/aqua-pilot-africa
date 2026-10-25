import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/contexts/SettingsContext';
import { buildEntries, trialBalance, incomeStatement, CHART, JOURNALS, JournalCode } from '@/lib/syscohada';
import { useAccountingLedger } from '@/hooks/useAccountingLedger';
import { ManualEntryForm, MarkingPanel, ClosingPanel } from './SyscohadaAdvanced';
import AccountNumberSettings, { useAccountOverrides, remapAccount } from './AccountNumberSettings';

const downloadCsv = (name: string, rows: (string | number)[][]) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
  a.download = name; a.click();
};

const SyscohadaAccounting: React.FC = () => {
  const { activeUnit, transactions, purchases } = useProductionUnits();
  const { sales } = useSales();
  const { formatCurrency } = useSettings();
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [account, setAccount] = useState('571');
  const [journal, setJournal] = useState<JournalCode>('VT');

  const ledgerData = useAccountingLedger(activeUnit?.id);
  const overrides = useAccountOverrides();
  const entries = useMemo(() => {
    const inRange = (d: string) => d >= from && d <= to;
    const u = activeUnit?.id;
    return [...buildEntries(
      sales.filter((s) => !u || s.unitId === u),
      (purchases as any[]).filter((p) => (!u || p.unitId === u) && inRange(p.date)),
      (transactions as any[]).filter((t) => (!u || t.unitId === u) && inRange(t.date)),
    ).filter((e) => inRange(e.date)), ...ledgerData.manual.filter((e) => inRange(e.date))]
      .map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l, account: remapAccount(l.account, overrides.map) })) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales, purchases, transactions, activeUnit?.id, from, to, ledgerData.manual, overrides.map]);

  const balance = useMemo(() => trialBalance(entries), [entries]);
  const cr = incomeStatement(balance);
  const sum = (pred: (a: string) => boolean, side: 'soldeD' | 'soldeC') => balance.filter((r) => pred(r.account)).reduce((s, r) => s + r[side], 0);
  const f = (n: number) => (n ? formatCurrency(n) : '—');
  const ledger = entries.filter((e) => e.lines.some((l) => l.account === account));
  let running = 0;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-3 flex flex-wrap gap-2 items-end">
          <div><label className="text-xs text-muted-foreground">Du</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Au</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Écritures générées automatiquement depuis les ventes, achats et dépenses de {activeUnit?.name || 'l’unité'} — plan SYSCOHADA révisé. Aucune double saisie.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="journaux">
        <TabsList className="flex flex-wrap h-auto rounded-xl">
          <TabsTrigger value="journaux">Journaux</TabsTrigger>
          <TabsTrigger value="grandlivre">Grand livre</TabsTrigger>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="etats">États financiers</TabsTrigger>
          <TabsTrigger value="plan">Plan de comptes</TabsTrigger>
          <TabsTrigger value="saisie">Saisie & ouverture</TabsTrigger>
          <TabsTrigger value="lettrage">Lettrage & banque</TabsTrigger>
          <TabsTrigger value="cloture">Clôture</TabsTrigger>
        </TabsList>
        {ledgerData.error && <p className="text-xs text-destructive">{ledgerData.error}</p>}
        <TabsContent value="saisie"><ManualEntryForm ledger={ledgerData} f={f} /></TabsContent>
        <TabsContent value="lettrage"><MarkingPanel ledger={ledgerData} entries={entries} f={f} /></TabsContent>
        <TabsContent value="cloture"><ClosingPanel ledger={ledgerData} balance={balance} to={to} f={f} /></TabsContent>


        <TabsContent value="journaux">
          <Card className="rounded-2xl"><CardContent className="p-3 space-y-2">
            <div className="mobile-action-grid flex flex-wrap gap-2">
              {(Object.keys(JOURNALS) as JournalCode[]).map((j) => (
                <Button key={j} size="sm" variant={journal === j ? 'default' : 'outline'} onClick={() => setJournal(j)}>{j} · {JOURNALS[j]}</Button>
              ))}
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm [&_td.text-right]:whitespace-nowrap [&_td.text-right]:tabular-nums">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Date</th><th>Libellé</th><th>Compte</th><th className="text-right">Débit</th><th className="text-right">Crédit</th></tr></thead>
              <tbody>
                {entries.filter((e) => e.journal === journal).flatMap((e) => e.lines.map((l, i) => (
                  <tr key={e.id + i} className="border-b border-border/50">
                    <td className="py-1">{i === 0 ? e.date : ''}</td><td>{i === 0 ? `${e.label}${e.ref ? ' · ' + e.ref : ''}` : ''}</td>
                    <td>{l.account} {CHART[l.account]}</td><td className="text-right">{f(l.debit)}</td><td className="text-right">{f(l.credit)}</td>
                  </tr>
                )))}
              </tbody>
            </table></div>
            {!entries.some((e) => e.journal === journal) && <p className="text-sm text-muted-foreground">Aucune écriture sur la période.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="grandlivre">
          <Card className="rounded-2xl"><CardContent className="p-3 space-y-2">
            <select className="w-full min-w-0 border border-input bg-background rounded-md h-9 px-2 text-sm" value={account} onChange={(e) => setAccount(e.target.value)}>
              {balance.map((r) => <option key={r.account} value={r.account}>{r.account} — {r.name}</option>)}
            </select>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm [&_td.text-right]:whitespace-nowrap [&_td.text-right]:tabular-nums">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Date</th><th>Jnl</th><th>Libellé</th><th className="text-right">Débit</th><th className="text-right">Crédit</th><th className="text-right">Solde</th></tr></thead>
              <tbody>{ledger.flatMap((e) => e.lines.filter((l) => l.account === account).map((l, i) => {
                running += l.debit - l.credit;
                return <tr key={e.id + i} className="border-b border-border/50"><td className="py-1">{e.date}</td><td>{e.journal}</td><td>{e.label}</td><td className="text-right">{f(l.debit)}</td><td className="text-right">{f(l.credit)}</td><td className="text-right font-medium">{formatCurrency(running)}</td></tr>;
              }))}</tbody>
            </table></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="balance">
          <Card className="rounded-2xl"><CardHeader className="pb-2 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-base">Balance générale</CardTitle>
            <Button size="sm" variant="outline" onClick={() => downloadCsv(`balance_${from}_${to}.csv`, [['Compte', 'Intitulé', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur'], ...balance.map((r) => [r.account, r.name, r.debit, r.credit, r.soldeD, r.soldeC])])}><Download className="w-4 h-4 mr-1" />Exporter</Button>
          </CardHeader><CardContent className="p-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm [&_td.text-right]:whitespace-nowrap [&_td.text-right]:tabular-nums">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Compte</th><th>Intitulé</th><th className="text-right">Débit</th><th className="text-right">Crédit</th><th className="text-right">Solde D</th><th className="text-right">Solde C</th></tr></thead>
              <tbody>{balance.map((r) => <tr key={r.account} className="border-b border-border/50"><td className="py-1">{r.account}</td><td>{r.name}</td><td className="text-right">{f(r.debit)}</td><td className="text-right">{f(r.credit)}</td><td className="text-right">{f(r.soldeD)}</td><td className="text-right">{f(r.soldeC)}</td></tr>)}</tbody>
              <tfoot><tr className="font-bold"><td colSpan={2} className="py-1">Totaux</td><td className="text-right">{f(balance.reduce((s, r) => s + r.debit, 0))}</td><td className="text-right">{f(balance.reduce((s, r) => s + r.credit, 0))}</td><td className="text-right">{f(balance.reduce((s, r) => s + r.soldeD, 0))}</td><td className="text-right">{f(balance.reduce((s, r) => s + r.soldeC, 0))}</td></tr></tfoot>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="etats">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Compte de résultat</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Produits (classe 7)</span><b>{formatCurrency(cr.produits)}</b></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Charges (classe 6)</span><b>{formatCurrency(cr.charges)}</b></div>
              <div className={`flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-1 ${cr.resultat < 0 ? 'text-destructive' : 'text-primary'}`}><span>Résultat net</span><b>{formatCurrency(cr.resultat)}</b></div>
            </CardContent></Card>
            <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Bilan simplifié</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Actif</p>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Créances clients (411)</span><span>{formatCurrency(sum((a) => a === '411', 'soldeD'))}</span></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Trésorerie-actif (52, 57)</span><span>{formatCurrency(sum((a) => a.startsWith('5'), 'soldeD'))}</span></div>
              <p className="text-xs font-semibold text-muted-foreground pt-2">Passif</p>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Dettes fournisseurs (401)</span><span>{formatCurrency(sum((a) => a === '401', 'soldeC'))}</span></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Trésorerie-passif (découverts)</span><span>{formatCurrency(sum((a) => a.startsWith('5'), 'soldeC'))}</span></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span>Résultat de la période</span><span>{formatCurrency(cr.resultat)}</span></div>
              <p className="text-xs text-muted-foreground pt-2">Capitaux propres, immobilisations et soldes d'ouverture non saisis : à compléter par votre comptable pour la liasse officielle.</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <AccountNumberSettings map={overrides.map} onSaved={overrides.reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SyscohadaAccounting;

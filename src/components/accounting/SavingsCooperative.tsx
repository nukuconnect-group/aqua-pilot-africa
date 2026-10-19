import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { memberBalance, canWithdraw, agentCollection, isMissingTable, SavingsTx } from '@/lib/savingsShop';

const db = supabase as any;
const today = () => new Date().toISOString().split('T')[0];

const SavingsCooperative: React.FC = () => {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();
  const unitId = activeUnit?.id;
  const [agents, setAgents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [txs, setTxs] = useState<(SavingsTx & { id: string; note?: string })[]>([]);
  const [missing, setMissing] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: '', phone: '', rate: '' });
  const [memberForm, setMemberForm] = useState({ book: '', name: '', phone: '', agent: '', daily: '' });
  const [txForm, setTxForm] = useState({ member: '', type: 'deposit', amount: '', date: today() });
  const [search, setSearch] = useState('');
  const m0 = today().slice(0, 8) + '01';
  const [from, setFrom] = useState(m0);
  const [to, setTo] = useState(today());

  const load = useCallback(async () => {
    if (!unitId) return;
    const [a, m, t] = await Promise.all([
      db.from('savings_agents').select('*').eq('unit_id', unitId).order('name'),
      db.from('savings_members').select('*').eq('unit_id', unitId).order('book_number'),
      db.from('savings_transactions').select('*').eq('unit_id', unitId).order('date', { ascending: false }).limit(2000),
    ]);
    if (a.error || m.error || t.error) { setMissing(isMissingTable(a.error || m.error || t.error)); return; }
    setMissing(false);
    setAgents(a.data || []); setMembers(m.data || []);
    setTxs((t.data || []).map((x: any) => ({ ...x, amount: Number(x.amount) })));
  }, [unitId]);
  useEffect(() => { load(); }, [load]);

  const base = () => ({ user_id: user?.id, unit_id: unitId });
  const run = async (p: Promise<any>, ok: string) => {
    const { error } = await p;
    if (error) toast({ title: 'Échec', description: error.message, variant: 'destructive' });
    else { toast({ title: ok }); load(); }
    return !error;
  };

  const balances = useMemo(() => new Map(members.map((m) => [m.id, memberBalance(m.id, txs)])), [members, txs]);
  const totalSavings = [...balances.values()].reduce((s, v) => s + v, 0);
  const memberName = (id: string) => members.find((m) => m.id === id)?.full_name || '—';

  const addTx = async () => {
    const member = members.find((m) => m.id === txForm.member);
    const amount = Number(txForm.amount);
    if (!member || !(amount > 0)) return toast({ title: 'Adhérent et montant requis', variant: 'destructive' });
    if (txForm.type === 'withdrawal' && !canWithdraw(balances.get(member.id) || 0, amount))
      return toast({ title: 'Solde insuffisant', description: `Disponible : ${formatCurrency(balances.get(member.id) || 0)}`, variant: 'destructive' });
    if (await run(db.from('savings_transactions').insert({ ...base(), member_id: member.id, agent_id: member.agent_id, type: txForm.type, amount, date: txForm.date }),
      txForm.type === 'deposit' ? 'Dépôt enregistré' : 'Retrait enregistré'))
      setTxForm({ ...txForm, amount: '' });
  };

  if (!unitId) return <p className="text-sm text-muted-foreground">Sélectionnez une unité.</p>;
  if (missing) return <Alert><AlertDescription>La caisse d'épargne n'est pas encore installée sur le serveur de l'application (fichier « savings_shop.sql »).</AlertDescription></Alert>;

  const sel = 'border border-input bg-background rounded-md h-9 px-2 text-sm w-full';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Épargne totale</p><p className="font-bold">{formatCurrency(totalSavings)}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Adhérents</p><p className="font-bold">{members.length}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Agents</p><p className="font-bold">{agents.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="ops">
        <TabsList className="flex flex-wrap h-auto rounded-xl">
          <TabsTrigger value="ops">Collecte</TabsTrigger>
          <TabsTrigger value="members">Adhérents</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="space-y-3">
          <Card className="rounded-2xl"><CardContent className="p-3 grid gap-2 sm:grid-cols-5 items-end">
            <select className={sel} value={txForm.member} onChange={(e) => setTxForm({ ...txForm, member: e.target.value })}>
              <option value="">Adhérent (carnet)</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.book_number} — {m.full_name}</option>)}
            </select>
            <select className={sel} value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}>
              <option value="deposit">Dépôt</option><option value="withdrawal">Retrait</option>
            </select>
            <Input type="number" placeholder="Montant" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
            <Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
            <Button onClick={addTx}>Enregistrer</Button>
          </CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Date</th><th>Adhérent</th><th>Type</th><th className="text-right">Montant</th></tr></thead>
            <tbody>{txs.slice(0, 100).map((t) => <tr key={t.id} className="border-b border-border/50"><td className="py-1">{t.date}</td><td>{memberName(t.member_id)}</td><td>{t.type === 'deposit' ? 'Dépôt' : 'Retrait'}</td><td className={`text-right ${t.type === 'withdrawal' ? 'text-destructive' : ''}`}>{formatCurrency(t.amount)}</td></tr>)}</tbody>
          </table>{txs.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune opération.</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-3">
          <Card className="rounded-2xl"><CardContent className="p-3 grid gap-2 sm:grid-cols-6 items-end">
            <Input placeholder="N° carnet" value={memberForm.book} onChange={(e) => setMemberForm({ ...memberForm, book: e.target.value })} />
            <Input placeholder="Nom complet" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
            <Input placeholder="Téléphone" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} />
            <select className={sel} value={memberForm.agent} onChange={(e) => setMemberForm({ ...memberForm, agent: e.target.value })}>
              <option value="">Agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Input type="number" placeholder="Mise / jour" value={memberForm.daily} onChange={(e) => setMemberForm({ ...memberForm, daily: e.target.value })} />
            <Button onClick={async () => {
              if (!memberForm.book.trim() || !memberForm.name.trim()) return toast({ title: 'Carnet et nom requis', variant: 'destructive' });
              if (await run(db.from('savings_members').insert({ ...base(), book_number: memberForm.book.trim(), full_name: memberForm.name.trim(), phone: memberForm.phone || null, agent_id: memberForm.agent || null, daily_amount: Number(memberForm.daily) || 0 }), 'Adhérent ajouté'))
                setMemberForm({ book: '', name: '', phone: '', agent: '', daily: '' });
            }}>Ajouter</Button>
          </CardContent></Card>
          <Input placeholder="Rechercher un adhérent ou un carnet" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Card className="rounded-2xl"><CardContent className="p-3 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Carnet</th><th>Nom</th><th>Téléphone</th><th>Agent</th><th className="text-right">Solde</th></tr></thead>
            <tbody>{members.filter((m) => `${m.book_number} ${m.full_name}`.toLowerCase().includes(search.toLowerCase())).map((m) => (
              <tr key={m.id} className="border-b border-border/50"><td className="py-1 font-mono">{m.book_number}</td><td>{m.full_name}</td><td>{m.phone || '—'}</td><td>{agents.find((a) => a.id === m.agent_id)?.name || '—'}</td><td className="text-right font-medium">{formatCurrency(balances.get(m.id) || 0)}</td></tr>
            ))}</tbody>
          </table>{members.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucun adhérent.</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-3">
          <Card className="rounded-2xl"><CardContent className="p-3 grid gap-2 sm:grid-cols-4 items-end">
            <Input placeholder="Nom de l'agent" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
            <Input placeholder="Téléphone" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} />
            <Input type="number" placeholder="Commission %" value={agentForm.rate} onChange={(e) => setAgentForm({ ...agentForm, rate: e.target.value })} />
            <Button onClick={async () => {
              if (!agentForm.name.trim()) return toast({ title: 'Nom requis', variant: 'destructive' });
              if (await run(db.from('savings_agents').insert({ ...base(), name: agentForm.name.trim(), phone: agentForm.phone || null, commission_rate: Number(agentForm.rate) || 0 }), 'Agent ajouté'))
                setAgentForm({ name: '', phone: '', rate: '' });
            }}>Ajouter</Button>
          </CardContent></Card>
          <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Collectes et commissions</CardTitle></CardHeader>
            <CardContent className="p-3 space-y-2">
              <div className="flex gap-2"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Agent</th><th>Taux</th><th className="text-right">Collecté</th><th className="text-right">Commission</th></tr></thead>
                <tbody>{agents.map((a) => { const c = agentCollection(a.id, Number(a.commission_rate), txs, from, to); return (
                  <tr key={a.id} className="border-b border-border/50"><td className="py-1">{a.name}</td><td>{Number(a.commission_rate)} %</td><td className="text-right">{formatCurrency(c.collected)}</td><td className="text-right font-medium">{formatCurrency(c.commission)}</td></tr>); })}</tbody>
              </table>
              {agents.length === 0 && <p className="text-sm text-muted-foreground text-center">Aucun agent.</p>}
            </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SavingsCooperative;

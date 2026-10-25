import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, RefreshCw, Plus, Clock, Brain, Snowflake, History, Loader2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/appClient';
import { supabase as cloud } from '@/integrations/supabase/client';
import { isColdStorage, temperatureSeries, temperatureSummary, type TemperatureObservation } from '@/lib/commercialInfrastructure';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import coldRoomImg from '@/assets/cold-room.jpg';

type AiRoom = { name: string; status: 'ok' | 'attention' | 'critique' | 'sans_donnees'; analysis: string; recommendations: string[] };
type AiResult = { summary: string; rooms: AiRoom[] };
const STATUS: Record<AiRoom['status'], { label: string; cls: string }> = {
  ok: { label: 'Conforme', cls: 'bg-primary/10 text-primary border-primary/30' },
  attention: { label: 'Attention', cls: 'bg-accent text-accent-foreground' },
  critique: { label: 'Critique', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  sans_donnees: { label: 'Sans données', cls: 'bg-muted text-muted-foreground' },
};

export default function ColdStorageOverview({ analysisOnly = false }: { analysisOnly?: boolean }) {
  const { activeUnit, getUnitInfrastructures } = useProductionUnits();
  const { user, isDemoMode } = useAuth();
  const rooms = activeUnit ? getUnitInfrastructures(activeUnit.id).filter(r => isColdStorage(r.type)) : [];
  const [selected, setSelected] = useState('all');
  const [days, setDays] = useState('7');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [ai, setAi] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  useEffect(() => { setSelected('all'); setRoomId(''); setDialogOpen(false); setAi(null); }, [activeUnit?.id]);
  const query = useQuery({
    queryKey: ['cold-storage-temperatures', user?.id, activeUnit?.id],
    enabled: Boolean(user?.id && activeUnit?.id && !isDemoMode),
    queryFn: async () => {
      const { data, error } = await supabase.from('health_records').select('id,unit_id,basin_id,temperature,date,created_at').eq('unit_id', activeUnit?.id || '').not('temperature', 'is', null).order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as TemperatureObservation[];
    },
  });
  const records = !isDemoMode ? query.data || [] : [];
  const cutoff = Date.now() - Number(days) * 86400000;
  const displayed = rooms.filter(r => selected === 'all' || r.id === selected);
  const limit = (room: typeof rooms[number], key: string) => { const v = room.specifications[key]; return v !== undefined && v !== null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined; };

  const saveReading = async () => {
    if (saving || !user?.id || !activeUnit || isDemoMode) return;
    if (!rooms.some(r => r.id === roomId) || !value.trim() || !Number.isFinite(Number(value))) {
      setSaveError('Sélectionnez une chambre froide et indiquez la température mesurée.'); return;
    }
    setSaving(true); setSaveError('');
    try {
      const { error } = await supabase.from('health_records').insert({ user_id: user.id, unit_id: activeUnit.id, basin_id: roomId, temperature: Number(value), date: new Date().toISOString().slice(0,10), notes: 'Relevé manuel de température · chambre froide' });
      if (error) throw error;
      await query.refetch(); setDialogOpen(false); setValue('');
    } catch { setSaveError('Le relevé n’a pas pu être enregistré. Votre saisie est conservée.'); }
    finally { setSaving(false); }
  };

  const runAnalysis = async () => {
    setAiLoading(true); setAiError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Connexion requise');
      const payload = { rooms: displayed.map(r => ({ name: r.name, type: r.type, min: limit(r, 'temperatureMin') ?? null, max: limit(r, 'temperatureMax') ?? null,
        readings: temperatureSeries(records, r.unitId, r.id).filter(p => p.time >= cutoff).slice(-300).map(p => ({ time: new Date(p.time).toISOString(), value: p.value })) })) };
      const { data, error } = await cloud.functions.invoke('cold-storage-analysis', { body: payload, headers: { Authorization: `Bearer ${session.access_token}` } });
      if (error || data?.error) throw new Error(data?.error || 'Analyse indisponible');
      setAi(data as AiResult);
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Analyse indisponible'); }
    finally { setAiLoading(false); }
  };

  const toolbar = <div className="flex flex-wrap items-center gap-2">
    <Select value={selected} onValueChange={setSelected}><SelectTrigger className="w-full sm:w-56" aria-label="Chambre froide"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les chambres froides</SelectItem>{rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
    <Select value={days} onValueChange={setDays}><SelectTrigger className="w-32" aria-label="Période"><SelectValue /></SelectTrigger><SelectContent>{['1','7','30','90'].map(d => <SelectItem key={d} value={d}>{d} jour{d === '1' ? '' : 's'}</SelectItem>)}</SelectContent></Select>
    <Button variant="outline" size="icon" aria-label="Actualiser" disabled={query.isFetching || isDemoMode} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button>
    {!analysisOnly && <Button disabled={!rooms.length || !user || isDemoMode} onClick={() => { setRoomId(rooms[0]?.id || ''); setSaveError(''); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Relevé</Button>}
  </div>;

  return <div className="space-y-5 min-w-0" data-cold-storage>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><Snowflake className="h-5 w-5 text-primary" /></div><div><h3 className="text-lg font-semibold">{analysisOnly ? 'Analyse thermique IA' : 'Gestion du froid'}</h3><p className="text-sm text-muted-foreground">Chambres froides · {activeUnit?.name}</p></div></div>
      {toolbar}
    </div>
    {query.isLoading && <p className="text-sm text-muted-foreground">Chargement des relevés…</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">Impossible de charger les températures. Réessayez avec Actualiser.</p>}
    {!rooms.length && <Card><CardContent className="py-10 text-center"><img src={coldRoomImg} alt="Chambre froide" className="mx-auto mb-4 h-32 w-48 rounded-lg object-cover" /><p className="font-medium">Aucune chambre froide enregistrée dans cette unité.</p><Button variant="link" onClick={() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'infrastructures' }))}>Ajouter une chambre froide</Button></CardContent></Card>}

    {analysisOnly ? (rooms.length > 0 && <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">L’IA analyse les températures enregistrées sur {days} jour{days === '1' ? '' : 's'} et propose des recommandations.</p>
        <Button onClick={runAnalysis} disabled={aiLoading || !user || isDemoMode || query.isLoading}>{aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}Lancer l’analyse IA</Button>
      </CardContent></Card>
      {aiError && <p role="alert" className="text-sm text-destructive">{aiError}</p>}
      {ai && <>
        <Card><CardContent className="p-4"><h4 className="font-semibold mb-1">Synthèse</h4><p className="text-sm">{ai.summary}</p></CardContent></Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{ai.rooms.map(r => { const room = rooms.find(x => x.name === r.name); const st = STATUS[r.status] || STATUS.sans_donnees; return <Card key={r.name} className="overflow-hidden"><CardContent className="p-0">
          <div className="flex items-center gap-3 p-4 border-b"><img src={coldRoomImg} alt="" className="h-12 w-16 rounded-md object-cover" /><div className="min-w-0 flex-1"><h5 className="font-semibold break-words">{r.name}</h5>{room && <p className="text-xs text-muted-foreground">{room.type.replace(/_/g, ' ')}</p>}</div><Badge variant="outline" className={st.cls}>{st.label}</Badge></div>
          <div className="p-4 space-y-3 text-sm"><p>{r.analysis}</p>{r.recommendations.length > 0 && <div><p className="font-medium mb-1">Recommandations</p><ul className="list-disc pl-5 space-y-1">{r.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}</div>
        </CardContent></Card>; })}</div>
        <p className="text-xs text-muted-foreground">Analyse générée par IA à partir des relevés ponctuels enregistrés ; à confirmer par contrôle sur place.</p>
      </>}
    </div>) : <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {displayed.map(room => {
        const points = temperatureSeries(records, room.unitId, room.id).filter(p => p.time >= cutoff);
        const min = limit(room, 'temperatureMin'), max = limit(room, 'temperatureMax');
        const summary = temperatureSummary(points, min, max);
        const outside = (v: number) => (min !== undefined && v < min) || (max !== undefined && v > max);
        return <Card key={room.id} className="overflow-hidden min-w-0"><CardContent className="p-0">
          <div className="relative h-36 sm:h-40">
            <img src={coldRoomImg} alt={`Chambre froide ${room.name}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3 text-background">
              <div className="min-w-0"><h4 className="font-semibold text-lg break-words">{room.name}</h4><p className="text-xs opacity-80 capitalize">{room.type.replace(/_/g, ' ')}{(min !== undefined || max !== undefined) ? ` · consigne ${min ?? '—'} à ${max ?? '—'} °C` : ''}</p></div>
              <div className="text-right shrink-0"><div className="text-3xl font-bold leading-none">{summary ? `${summary.latest.value.toLocaleString('fr-FR')}°` : '—'}</div><p className="text-[11px] opacity-80">{summary ? 'Dernier relevé' : 'Sans relevé'}</p></div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {summary ? <>
              <div className="grid grid-cols-3 gap-2 text-sm">{[['Minimum',summary.min],['Moyenne',summary.average],['Maximum',summary.max]].map(([label,v]) => <div key={label} className="rounded-md bg-muted/50 p-2 text-center"><p className="text-xs text-muted-foreground">{label}</p><strong>{Number(v).toLocaleString('fr-FR',{maximumFractionDigits:1})} °C</strong></div>)}</div>
              <div className="h-48 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{left:0,right:12,top:10,bottom:10}}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={v => new Date(v).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis width={36} domain={['auto','auto']} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip labelFormatter={v=>new Date(Number(v)).toLocaleString('fr-FR')} formatter={v=>[`${v} °C`,'Température']} />{min !== undefined && <ReferenceLine y={min} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />}{max !== undefined && <ReferenceLine y={max} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />}<Line dataKey="value" type="linear" stroke="hsl(var(--primary))" strokeWidth={2} dot={{r:3}} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
              <section className="border-t pt-3"><h5 className="font-semibold text-sm flex items-center gap-2 mb-2"><History className="h-4 w-4" />Traçabilité des relevés</h5>
                <ul className="max-h-48 overflow-y-auto divide-y text-sm">{[...points].reverse().map((p, i) => <li key={i} className="flex justify-between py-1.5"><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{new Date(p.time).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span className={outside(p.value) ? 'font-semibold text-destructive' : 'font-medium'}>{p.value.toLocaleString('fr-FR')} °C</span></li>)}</ul>
                {summary.outsideCount > 0 && <p className="mt-2 text-sm text-destructive">{summary.outsideCount} relevé{summary.outsideCount > 1 ? 's' : ''} hors consigne.</p>}
              </section>
            </> : <p className="py-4 text-sm text-muted-foreground">Aucune température enregistrée sur cette période. Aucun capteur connecté vérifié.</p>}
          </div>
        </CardContent></Card>;
      })}
    </div>}

    <Dialog open={dialogOpen} onOpenChange={open => { if (!saving) setDialogOpen(open); }}><DialogContent className="w-[calc(100%-2rem)] max-w-md"><DialogHeader><DialogTitle>Relevé de température</DialogTitle></DialogHeader><Label>Chambre froide</Label><Select value={roomId} onValueChange={setRoomId} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{rooms.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><Label htmlFor="cold-temperature">Température mesurée (°C)</Label><Input id="cold-temperature" type="number" step="0.1" value={value} disabled={saving} onChange={e=>setValue(e.target.value)} />{saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}<Button onClick={saveReading} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le relevé'}</Button></DialogContent></Dialog>
  </div>;
}

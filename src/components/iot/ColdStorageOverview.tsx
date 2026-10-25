import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Thermometer, RefreshCw, Plus, Clock } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/appClient';
import { isColdStorage, temperatureSeries, temperatureSummary, type TemperatureObservation } from '@/lib/commercialInfrastructure';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ColdStorageOverview({ analysisOnly = false }: { analysisOnly?: boolean }) {
  const { activeUnit, getUnitInfrastructures } = useProductionUnits();
  const { user, isDemoMode } = useAuth();
  const rooms = activeUnit ? getUnitInfrastructures(activeUnit.id) : [];
  const [selected, setSelected] = useState('all');
  const [days, setDays] = useState('7');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { setSelected('all'); setRoomId(''); setDialogOpen(false); }, [activeUnit?.id]);
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
  const saveReading = async () => {
    if (saving || !user?.id || !activeUnit || isDemoMode) return;
    if (!rooms.some(r => r.id === roomId) || !value.trim() || !Number.isFinite(Number(value))) {
      setSaveError('Sélectionnez une infrastructure et indiquez la température mesurée.'); return;
    }
    setSaving(true); setSaveError('');
    try {
      const { error } = await supabase.from('health_records').insert({ user_id: user.id, unit_id: activeUnit.id, basin_id: roomId, temperature: Number(value), date: new Date().toISOString().slice(0,10), notes: 'Relevé manuel de température · infrastructure commerciale' });
      if (error) throw error;
      await query.refetch(); setDialogOpen(false); setValue('');
    } catch { setSaveError('Le relevé n’a pas pu être enregistré. Votre saisie est conservée.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5 min-w-0" data-cold-storage>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold">{analysisOnly ? 'Analyse thermique' : 'Paramètres des infrastructures'}</h3><p className="text-sm text-muted-foreground">Températures enregistrées · {activeUnit?.name}</p></div>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon" aria-label="Actualiser les températures" disabled={query.isFetching || isDemoMode} onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button><Button disabled={!rooms.length || !user || isDemoMode} onClick={() => { setRoomId(rooms[0]?.id || ''); setSaveError(''); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Relevé de température</Button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="min-w-0 overflow-x-auto"><Tabs value={selected} onValueChange={setSelected}><TabsList className="w-max min-w-full"><TabsTrigger value="all">Toutes les infrastructures</TabsTrigger>{rooms.map(r => <TabsTrigger key={r.id} value={r.id} className="whitespace-nowrap">{r.name}</TabsTrigger>)}</TabsList></Tabs></div>
      <Select value={days} onValueChange={setDays}><SelectTrigger aria-label="Période des températures"><SelectValue /></SelectTrigger><SelectContent>{['1','7','30','90'].map(d => <SelectItem key={d} value={d}>{d} jour{d === '1' ? '' : 's'}</SelectItem>)}</SelectContent></Select>
    </div>
    {query.isLoading && <p className="text-sm text-muted-foreground">Chargement des relevés…</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">Impossible de charger les températures. Réessayez avec Actualiser.</p>}
    {!rooms.length && <div className="py-10 text-center"><Thermometer className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p>Aucune infrastructure enregistrée dans cette unité.</p><Button variant="link" onClick={() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'infrastructures' }))}>Ouvrir Infrastructures</Button></div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {displayed.map(room => {
        const points = temperatureSeries(records, room.unitId, room.id).filter(p => p.time >= cutoff);
        const limit = (key: string) => { const v = room.specifications[key]; return v !== undefined && v !== null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined; };
        const min = limit('temperatureMin'), max = limit('temperatureMax');
        const summary = temperatureSummary(points, min, max);
        return <Card key={room.id} className="overflow-hidden min-w-0"><CardContent className="p-0">
          <div className="flex items-start gap-3 p-4 border-b border-l-4 border-l-primary">
            <div className="rounded-md bg-primary/10 p-2"><Thermometer className="size-5 text-primary" /></div>
            <div className="min-w-0"><h4 className="font-semibold break-words">{room.name}</h4><Badge variant="outline" className="mt-1">{summary ? 'Relevés enregistrés' : 'Sans relevé'}</Badge><div className="mt-2 text-2xl font-semibold text-primary">{summary ? `${summary.latest.value.toLocaleString('fr-FR')} °C` : '— °C'}</div>{summary && <p className="text-xs text-muted-foreground">Dernier enregistrement : {new Date(summary.latest.time).toLocaleString('fr-FR')}</p>}</div>
          </div>
          <div className="p-4 space-y-4">
            {(min !== undefined || max !== undefined) && <p className="text-sm text-muted-foreground">Limites configurées : {min ?? '—'} à {max ?? '—'} °C</p>}
            {summary ? <>
              <div className="grid grid-cols-3 gap-3 text-sm">{[['Minimum',summary.min],['Moyenne',summary.average],['Maximum',summary.max]].map(([label,v]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><strong>{Number(v).toLocaleString('fr-FR',{maximumFractionDigits:1})} °C</strong></div>)}</div>
              <div className="h-52 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{left:0,right:12,top:10,bottom:10}}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={v => new Date(v).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} stroke="hsl(var(--muted-foreground))" /><YAxis width={40} domain={['auto','auto']} stroke="hsl(var(--muted-foreground))" /><Tooltip labelFormatter={v=>new Date(Number(v)).toLocaleString('fr-FR')} formatter={v=>[`${v} °C`,'Température enregistrée']} />{min !== undefined && <ReferenceLine y={min} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />}{max !== undefined && <ReferenceLine y={max} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />}<Line dataKey="value" type="linear" stroke="hsl(var(--primary))" strokeWidth={2} dot={{r:3}} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
              <section className="border-t pt-3 text-sm space-y-2"><h5 className="font-semibold">Analyse thermique</h5><p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" />{points.length} relevé{points.length > 1 ? 's' : ''} · intervalle observé : {summary.observedHours.toLocaleString('fr-FR',{maximumFractionDigits:1})} h</p><p>Variation entre premier et dernier relevé : {summary.variation > 0 ? '+' : ''}{summary.variation.toLocaleString('fr-FR',{maximumFractionDigits:1})} °C</p>{(min !== undefined || max !== undefined) ? <p className={summary.outsideCount ? 'text-destructive' : 'text-muted-foreground'}>{summary.outsideCount} relevé{summary.outsideCount > 1 ? 's' : ''} hors limites configurées{summary.outsideCount > 0 ? ' · Contrôlez la conservation et le système de froid.' : ''}</p> : <p className="text-muted-foreground">Limites de température non renseignées.</p>}<p className="text-xs text-muted-foreground">Relevés ponctuels : la durée exacte d’un dépassement n’est pas déterminable sans suivi continu.</p></section>
            </> : <p className="py-6 text-sm text-muted-foreground">Aucune température enregistrée sur cette période. Aucun capteur connecté vérifié.</p>}
          </div>
        </CardContent></Card>;
      })}
    </div>
    <Dialog open={dialogOpen} onOpenChange={open => { if (!saving) setDialogOpen(open); }}><DialogContent className="w-[calc(100%-2rem)] max-w-md"><DialogHeader><DialogTitle>Relevé manuel de température</DialogTitle></DialogHeader><Label>Infrastructure</Label><Select value={roomId} onValueChange={setRoomId} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{rooms.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><Label htmlFor="cold-temperature">Température mesurée (°C)</Label><Input id="cold-temperature" type="number" step="0.1" value={value} disabled={saving} onChange={e=>setValue(e.target.value)} />{saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}<Button onClick={saveReading} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le relevé'}</Button></DialogContent></Dialog>
  </div>;
}
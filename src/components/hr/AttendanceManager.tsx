import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, MapPin, Camera, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useEmployees } from '@/hooks/useEmployees';
import { useToast } from '@/hooks/use-toast';
import { distanceMeters, dailySummary } from '@/lib/attendance';

interface Rec { client_id: string; employee_id: string; kind: 'in' | 'out'; recorded_at: string; latitude?: number; longitude?: number; distance_m?: number; inside_zone?: boolean; photo_path?: string; unit_id?: string; user_id: string }
interface Zone { lat: number; lng: number; radius: number; start: string; end: string }

const QUEUE = 'aquapilote-attendance-queue';
const readQueue = (): (Rec & { photo?: string })[] => { try { return JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch { return []; } };
const writeQueue = (q: unknown[]) => localStorage.setItem(QUEUE, JSON.stringify(q));

const getPosition = () => new Promise<GeolocationPosition | null>((res) => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 15000 });
});

const fileToDataUrl = (f: File) => new Promise<string>((res) => {
  const img = new Image(); const r = new FileReader();
  r.onload = () => { img.src = r.result as string; };
  img.onload = () => {
    const c = document.createElement('canvas'); const s = Math.min(1, 480 / img.width);
    c.width = img.width * s; c.height = img.height * s;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    res(c.toDataURL('image/jpeg', 0.7));
  };
  r.readAsDataURL(f);
});

const AttendanceManager: React.FC = () => {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const db = supabase as any;
  const zoneKey = `aquapilote-zone-${activeUnit?.id}`;
  const [zone, setZone] = useState<Zone>(() => ({ lat: 0, lng: 0, radius: 200, start: '08:00', end: '17:00', ...JSON.parse(localStorage.getItem(zoneKey) || '{}') }));
  const [employeeId, setEmployeeId] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [records, setRecords] = useState<Rec[]>([]);
  const [pending, setPending] = useState(readQueue().length);
  const [notInstalled, setNotInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setZone({ lat: 0, lng: 0, radius: 200, start: '08:00', end: '17:00', ...JSON.parse(localStorage.getItem(zoneKey) || '{}') }); }, [zoneKey]);
  const saveZone = (z: Zone) => { setZone(z); localStorage.setItem(zoneKey, JSON.stringify(z)); };

  const unitEmployees = employees.filter((e) => e.status !== 'inactive' && (!activeUnit || e.unitId === activeUnit.id));

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 31);
    const { data, error } = await db.from('attendance_records').select('*').gte('recorded_at', since.toISOString()).order('recorded_at', { ascending: false });
    if (error) { setNotInstalled(/does not exist|schema cache/i.test(error.message)); return; }
    setRecords((data || []).filter((r: Rec) => !activeUnit || r.unit_id === activeUnit.id));
  }, [user, activeUnit?.id]);

  const flush = useCallback(async () => {
    const q = readQueue(); if (!q.length || !navigator.onLine) return;
    const left: typeof q = [];
    for (const item of q) {
      const { photo: p, ...rec } = item;
      if (p) {
        const path = `${rec.user_id}/attendance/${rec.client_id}.jpg`;
        const blob = await (await fetch(p)).blob();
        const up = await supabase.storage.from('user-files').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (!up.error) rec.photo_path = path;
      }
      const { error } = await db.from('attendance_records').upsert(rec, { onConflict: 'client_id' });
      if (error) left.push(item);
    }
    writeQueue(left); setPending(left.length); load();
  }, [load]);

  useEffect(() => { load(); flush(); window.addEventListener('online', flush); return () => window.removeEventListener('online', flush); }, [load, flush]);

  const punch = async (kind: 'in' | 'out') => {
    if (!user || !employeeId) return toast({ title: 'Choisissez un employé', variant: 'destructive' });
    setBusy(true);
    const pos = await getPosition();
    const lat = pos?.coords.latitude, lng = pos?.coords.longitude;
    const hasZone = zone.lat !== 0 || zone.lng !== 0;
    const dist = lat != null && hasZone ? distanceMeters({ lat, lng: lng! }, zone) : undefined;
    const inside = dist != null ? dist <= zone.radius : undefined;
    const rec = { client_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user_id: user.id, unit_id: activeUnit?.id, employee_id: employeeId, kind, recorded_at: new Date().toISOString(), latitude: lat, longitude: lng, distance_m: dist ? Math.round(dist) : undefined, inside_zone: inside, photo: photo || undefined };
    writeQueue([...readQueue(), rec]); setPending(readQueue().length);
    setPhoto(null); setBusy(false);
    toast({ title: kind === 'in' ? 'Arrivée enregistrée' : 'Départ enregistré', description: inside === false ? `Hors zone autorisée (${Math.round(dist!)} m)` : navigator.onLine ? undefined : 'Hors ligne : envoi automatique au retour du réseau' });
    flush();
  };

  const summary = useMemo(() => {
    const byKey = new Map<string, { emp: string; day: string; ins: Date[]; outs: Date[] }>();
    records.forEach((r) => {
      const day = r.recorded_at.slice(0, 10); const k = r.employee_id + day;
      const v = byKey.get(k) || { emp: r.employee_id, day, ins: [], outs: [] };
      (r.kind === 'in' ? v.ins : v.outs).push(new Date(r.recorded_at)); byKey.set(k, v);
    });
    const today = new Date().toISOString().slice(0, 10);
    return [...byKey.values()].map((v) => ({ ...v, ...dailySummary(v.ins, v.outs, zone.start, zone.end, v.day < today) }));
  }, [records, zone.start, zone.end]);

  const name = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : 'Employé'; };

  if (notInstalled) return <Alert><AlertDescription>Le pointage n'est pas encore activé sur votre serveur : le fichier « hr_attendance.sql » doit y être exécuté une fois.</AlertDescription></Alert>;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">Pointage mobile {pending > 0 && <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" />{pending} en attente</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full border border-input bg-background rounded-md h-10 px-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Choisir l'employé…</option>
            {unitEmployees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer border border-dashed border-border rounded-xl p-3">
            <Camera className="w-4 h-4" />{photo ? 'Photo prise ✓' : 'Prendre une photo (facultatif)'}
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f)); }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12" disabled={busy} onClick={() => punch('in')}><LogIn className="w-4 h-4 mr-2" />Arrivée</Button>
            <Button className="h-12" variant="outline" disabled={busy} onClick={() => punch('out')}><LogOut className="w-4 h-4 mr-2" />Départ</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />Zone autorisée et horaires</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <Input type="number" placeholder="Latitude" value={zone.lat || ''} onChange={(e) => saveZone({ ...zone, lat: Number(e.target.value) })} />
          <Input type="number" placeholder="Longitude" value={zone.lng || ''} onChange={(e) => saveZone({ ...zone, lng: Number(e.target.value) })} />
          <Input type="number" placeholder="Rayon (m)" value={zone.radius} onChange={(e) => saveZone({ ...zone, radius: Number(e.target.value) })} />
          <Input type="time" value={zone.start} onChange={(e) => saveZone({ ...zone, start: e.target.value })} />
          <Input type="time" value={zone.end} onChange={(e) => saveZone({ ...zone, end: e.target.value })} />
          <Button size="sm" variant="secondary" className="col-span-2 md:col-span-5" onClick={async () => { const p = await getPosition(); if (p) saveZone({ ...zone, lat: p.coords.latitude, lng: p.coords.longitude }); else toast({ title: 'Position indisponible', variant: 'destructive' }); }}>Utiliser ma position actuelle comme site</Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Présences des 31 derniers jours</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {summary.length === 0 ? <p className="text-sm text-muted-foreground">Aucun pointage enregistré.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Date</th><th>Employé</th><th>Arrivée</th><th>Départ</th><th>Retard</th><th>Heures sup.</th><th></th></tr></thead>
              <tbody>{summary.map((s) => (
                <tr key={s.emp + s.day} className="border-b border-border/50">
                  <td className="py-1">{s.day}</td><td>{name(s.emp)}</td>
                  <td>{s.ins[0] ? new Date(Math.min(...s.ins.map(Number))).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{s.outs[0] ? new Date(Math.max(...s.outs.map(Number))).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className={s.lateMinutes ? 'text-destructive' : ''}>{s.lateMinutes ? `${s.lateMinutes} min` : '—'}</td>
                  <td>{s.overtimeMinutes ? `${(s.overtimeMinutes / 60).toFixed(1)} h` : '—'}</td>
                  <td>{s.missingOut && <Badge variant="destructive">Sortie oubliée</Badge>}</td>
                </tr>))}</tbody></table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceManager;

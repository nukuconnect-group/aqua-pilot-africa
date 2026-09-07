import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList, Radio, RadioTower, Download, Search, Loader2, Building2, MapPin, Phone, Mail, Factory } from 'lucide-react';

interface RegistrationRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  country_code: string | null;
  company_name: string | null;
  company_address: string | null;
  exploitation_type: string | null;
  needs_sensors: boolean | null;
  production_units: string[] | null;
  is_activated: boolean | null;
  created_at: string;
}

type FilterMode = 'all' | 'sensors' | 'no_sensors';

const RegistrationsPanel: React.FC = () => {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,phone,country,country_code,company_name,company_address,exploitation_type,needs_sensors,production_units,is_activated,created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && data) setRows(data as RegistrationRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'sensors' && !r.needs_sensors) return false;
      if (filter === 'no_sensors' && r.needs_sensors) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.company_name || '').toLowerCase().includes(q) ||
        (r.country || '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const exportCsv = () => {
    const header = ['Date','Nom','Email','Téléphone','Pays','Ferme','Adresse','Exploitation','Capteurs IoT','Types élevage'];
    const lines = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.full_name || '',
      r.email || '',
      r.phone || '',
      r.country || '',
      r.company_name || '',
      r.company_address || '',
      r.exploitation_type || '',
      r.needs_sensors ? 'Oui' : 'Non',
      (r.production_units || []).join(' | '),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscriptions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const withSensors = rows.filter((r) => r.needs_sensors).length;
  const withoutSensors = rows.length - withSensors;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total inscriptions</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </div>
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avec capteurs IoT</p>
              <p className="text-2xl font-bold text-blue-600">{withSensors}</p>
            </div>
            <RadioTower className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sans capteurs</p>
              <p className="text-2xl font-bold text-slate-600">{withoutSensors}</p>
            </div>
            <Radio className="w-8 h-8 text-slate-500" />
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Formulaires d'inscription</CardTitle>
              <CardDescription>Détails saisis par les utilisateurs lors de leur inscription.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" /> Exporter CSV
            </Button>
          </div>
          <div className="flex flex-col md:flex-row gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, email, ferme, pays)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tous</Button>
              <Button variant={filter === 'sensors' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('sensors')}>Avec capteurs</Button>
              <Button variant={filter === 'no_sensors' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('no_sensors')}>Sans capteurs</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Aucune inscription trouvée.</div>
          ) : (
            <ScrollArea className="h-[560px] pr-2">
              <div className="space-y-3">
                {filtered.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-base">{r.full_name || '—'}</h4>
                          {r.needs_sensors ? (
                            <Badge className="bg-blue-600 hover:bg-blue-700"><RadioTower className="w-3 h-3 mr-1" /> Capteurs IoT</Badge>
                          ) : (
                            <Badge variant="secondary">Sans capteurs</Badge>
                          )}
                          {r.exploitation_type && (
                            <Badge variant="outline"><Factory className="w-3 h-3 mr-1" /> {r.exploitation_type.replace('_', ' ')}</Badge>
                          )}
                          {r.country && (
                            <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" /> {r.country}</Badge>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {r.email}</div>
                          {r.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {r.phone}</div>}
                          {r.company_name && <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> {r.company_name}</div>}
                          {r.company_address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {r.company_address}</div>}
                        </div>
                        {r.production_units && r.production_units.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.production_units.map((u) => (
                              <Badge key={u} variant="outline" className="text-xs">{u}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistrationsPanel;
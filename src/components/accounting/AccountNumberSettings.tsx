import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { CHART } from '@/lib/syscohada';

export interface AccountOverride { default_code: string; custom_code: string; custom_label: string | null }
const db = supabase as any;

/** Remplace les numéros/libellés par défaut par ceux choisis par l'équipe comptable. */
export const remapAccount = (code: string, map: Record<string, AccountOverride>) => map[code]?.custom_code || code;

export const useAccountOverrides = () => {
  const [map, setMap] = useState<Record<string, AccountOverride>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('accounting_account_settings').select('default_code,custom_code,custom_label');
    setMap(Object.fromEntries((data || []).map((r: AccountOverride) => [r.default_code, r])));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { map, reload: load };
};

const AccountNumberSettings: React.FC<{ map: Record<string, AccountOverride>; onSaved: () => void }> = ({ map, onSaved }) => {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Record<string, { code: string; label: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const rows = Object.entries(CHART).filter(([k, v]) => !q || `${k} ${v} ${map[k]?.custom_code || ''}`.toLowerCase().includes(q.toLowerCase()));
  const val = (k: string) => draft[k] ?? { code: map[k]?.custom_code || k, label: map[k]?.custom_label || CHART[k] };

  const save = async (k: string) => {
    const v = val(k);
    if (!/^[1-9][0-9]{1,9}$/.test(v.code)) return toast({ title: 'Numéro invalide', description: 'Chiffres uniquement, 2 à 10 chiffres.', variant: 'destructive' });
    if (v.code[0] !== k[0]) return toast({ title: 'Classe différente', description: `Le compte doit rester en classe ${k[0]} pour garder des états financiers justes.`, variant: 'destructive' });
    const dup = Object.values(map).find((m) => m.custom_code === v.code && m.default_code !== k);
    if (dup || (v.code !== k && CHART[v.code] && !map[v.code])) return toast({ title: 'Numéro déjà utilisé', variant: 'destructive' });
    setBusy(k);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from('accounting_account_settings').upsert(
      { user_id: user?.id, default_code: k, custom_code: v.code, custom_label: v.label, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,default_code' });
    setBusy(null);
    if (error) return toast({ title: 'Enregistrement impossible', description: error.message, variant: 'destructive' });
    setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
    toast({ title: 'Compte mis à jour', description: `${k} → ${v.code}` });
    onSaved();
  };

  const reset = async (k: string) => {
    setBusy(k);
    await db.from('accounting_account_settings').delete().eq('default_code', k);
    setBusy(null); setDraft((d) => { const n = { ...d }; delete n[k]; return n; }); onSaved();
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Paramètres des numéros de comptes</CardTitle>
        <p className="text-sm text-muted-foreground">Adaptez les numéros et libellés à votre plan interne (ex. 571 → 5711). Les écritures, le grand livre et la balance utilisent aussitôt vos numéros. La classe du compte (premier chiffre) ne peut pas changer.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un compte" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="divide-y divide-border rounded-md border border-border">
          {rows.map(([k]) => {
            const v = val(k); const changed = !!draft[k]; const custom = !!map[k];
            return (
              <div key={k} className="grid grid-cols-[3.5rem_6.5rem_1fr_auto] items-center gap-2 px-2 py-1.5">
                <span className="font-mono text-xs text-muted-foreground">{k}</span>
                <Input aria-label={`Numéro du compte ${k}`} className="h-8 font-mono" value={v.code} onChange={(e) => setDraft((d) => ({ ...d, [k]: { ...v, code: e.target.value.trim() } }))} />
                <Input aria-label={`Libellé du compte ${k}`} className="h-8" value={v.label} onChange={(e) => setDraft((d) => ({ ...d, [k]: { ...v, label: e.target.value } }))} />
                <div className="flex gap-1">
                  <Button size="icon" variant={changed ? 'default' : 'ghost'} className="h-8 w-8" disabled={!changed || busy === k} onClick={() => save(k)} aria-label="Enregistrer"><Save className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!custom || busy === k} onClick={() => reset(k)} aria-label="Revenir au numéro SYSCOHADA"><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountNumberSettings;

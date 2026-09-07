import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Lock, Search, Download, Play, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

type Plan = 'free' | 'standard' | 'premium' | 'enterprise';
const PLAN_RANK: Record<Plan, number> = { free: 0, standard: 1, premium: 2, enterprise: 3 };

interface LibItem {
  id: string; title: string; description: string | null; category: string;
  item_type: string; file_path: string | null; external_url: string | null;
  thumbnail_url: string | null; plan_min: Plan; tags: string[] | null;
  duration_minutes: number | null; size_bytes: number | null;
}

const PremiumLibrary: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<LibItem[]>([]);
  const [userPlan, setUserPlan] = useState<Plan>('free');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('premium_library_items').select('*').eq('is_published', true).order('created_at', { ascending: false });
      setItems((data ?? []) as LibItem[]);
    })();
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('subscriptions').select('plan,status').eq('user_id', user.id).maybeSingle();
      const p = (data as any)?.plan as Plan | undefined;
      const status = (data as any)?.status;
      if (p && (status === 'active' || status === 'trialing')) setUserPlan(p);
    })();
  }, [user?.id]);

  const filtered = useMemo(() => items.filter(i => {
    if (typeFilter !== 'all' && i.item_type !== typeFilter) return false;
    if (query && !`${i.title} ${i.description ?? ''} ${(i.tags ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [items, query, typeFilter]);

  const canAccess = (item: LibItem) => PLAN_RANK[userPlan] >= PLAN_RANK[item.plan_min];

  const handleOpen = async (item: LibItem) => {
    if (!canAccess(item)) {
      toast({ title: 'Accès restreint', description: `Plan ${item.plan_min} requis. Mettez à niveau votre abonnement.`, variant: 'destructive' });
      return;
    }
    if (user?.id) await supabase.from('premium_library_views').insert({ item_id: item.id, user_id: user.id });
    if (item.external_url) { window.open(item.external_url, '_blank'); return; }
    if (item.file_path) {
      const { data, error } = await supabase.storage.from('premium-library').createSignedUrl(item.file_path, 300);
      if (error || !data) { toast({ title: 'Erreur', description: error?.message ?? 'Impossible d’ouvrir le fichier', variant: 'destructive' }); return; }
      window.open(data.signedUrl, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><BookOpen className="w-6 h-6 text-primary" /></div>
            <div>
              <CardTitle className="text-xl">Bibliothèque Premium</CardTitle>
              <CardDescription>Manuels, guides, SOP et vidéos de formation aquacole.</CardDescription>
            </div>
            <Badge variant="outline" className="ml-auto capitalize">Plan : {userPlan}</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un document..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="guide">Guide</SelectItem>
            <SelectItem value="sop">SOP</SelectItem>
            <SelectItem value="video">Vidéo</SelectItem>
            <SelectItem value="webinar">Webinaire</SelectItem>
            <SelectItem value="fiche">Fiche</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun document disponible.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const locked = !canAccess(item);
            return (
              <Card key={item.id} className={locked ? 'opacity-75' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{item.title}</CardTitle>
                    {locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] uppercase">{item.item_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    <Badge className="text-[10px] capitalize">{item.plan_min}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.description && <p className="text-xs text-muted-foreground line-clamp-3">{item.description}</p>}
                  <Button size="sm" variant={locked ? 'outline' : 'default'} className="w-full" onClick={() => handleOpen(item)}>
                    {locked ? <><Lock className="w-3 h-3 mr-2" />Plan {item.plan_min} requis</> :
                      item.item_type === 'video' || item.item_type === 'webinar' ? <><Play className="w-3 h-3 mr-2" />Lire</> :
                      item.external_url ? <><FileText className="w-3 h-3 mr-2" />Ouvrir</> : <><Download className="w-3 h-3 mr-2" />Télécharger</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PremiumLibrary;
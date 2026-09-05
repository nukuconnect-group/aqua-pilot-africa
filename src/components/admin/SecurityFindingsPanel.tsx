import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldAlert, ShieldCheck, EyeOff, Plus, RefreshCw, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/clientConfig';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { exportRowsToCsv, exportRowsToPdf, timestampSuffix, type ExportColumn } from '@/lib/adminExportUtils';

const FINDING_COLUMNS: ExportColumn<SecurityFinding>[] = [
  { header: 'Détectée le', value: (f) => format(new Date(f.detected_at), 'dd/MM/yyyy HH:mm'), width: 30 },
  { header: 'Gravité', value: (f) => f.severity.toUpperCase(), width: 22 },
  { header: 'Statut', value: (f) => f.status, width: 20 },
  { header: 'Scanner', value: (f) => f.scanner_name || '-', width: 32 },
  { header: 'Identifiant', value: (f) => f.internal_id || '-', width: 36 },
  { header: 'Titre', value: (f) => f.title, width: 55 },
  { header: 'Description', value: (f) => f.description || '-' },
  { header: 'Source', value: (f) => f.source || '-', width: 30 },
  { header: 'Résolue le', value: (f) => (f.resolved_at ? format(new Date(f.resolved_at), 'dd/MM/yyyy HH:mm') : '-'), width: 30 },
];

export interface SecurityFinding {
  id: string;
  scanner_name: string;
  internal_id: string | null;
  title: string;
  description: string | null;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'fixed' | 'ignored';
  source: string | null;
  resolution_note: string | null;
  detected_at: string;
  resolved_at: string | null;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-destructive/80 text-destructive-foreground',
  medium: 'bg-amber-500 text-white',
  low: 'bg-sky-500 text-white',
  info: 'bg-muted text-muted-foreground',
};

const SEEN_KEY = 'aqua-security-findings-seen';

export const useSecurityFindings = () => {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('security_findings')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(300);
    if (!error && data) setFindings(data as unknown as SecurityFinding[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`security-findings-changes-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_findings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const openCount = useMemo(() => findings.filter((f) => f.status === 'open').length, [findings]);

  const newCount = useMemo(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    } catch {
      seen = [];
    }
    return findings.filter((f) => f.status === 'open' && !seen.includes(f.id)).length;
  }, [findings]);

  const markAllSeen = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(findings.map((f) => f.id)));
    } catch {
      /* storage unavailable */
    }
  }, [findings]);

  return { findings, loading, reload: load, openCount, newCount, markAllSeen };
};

const SecurityFindingsPanel: React.FC = () => {
  const { toast } = useToast();
  const { findings, loading, reload, openCount, markAllSeen } = useSecurityFindings();
  const [filter, setFilter] = useState<'all' | 'open' | 'fixed' | 'ignored'>('open');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', severity: 'medium', source: '' });

  useEffect(() => {
    if (!loading) markAllSeen();
  }, [loading, markAllSeen]);

  const visible = useMemo(
    () => (filter === 'all' ? findings : findings.filter((f) => f.status === filter)),
    [findings, filter],
  );

  const updateStatus = async (finding: SecurityFinding, status: 'open' | 'fixed' | 'ignored') => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('security_findings')
      .update({
        status,
        resolved_at: status === 'open' ? null : new Date().toISOString(),
        resolved_by: status === 'open' ? null : userData.user?.id ?? null,
      })
      .eq('id', finding.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Alerte mise à jour', description: `« ${finding.title} » → ${status}` });
    reload();
  };

  const addFinding = async () => {
    if (!draft.title.trim()) {
      toast({ title: 'Titre requis', description: 'Renseignez un titre pour l\u2019alerte.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('security_findings').insert({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      severity: draft.severity,
      source: draft.source.trim() || null,
      scanner_name: 'manual',
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setDraft({ title: '', description: '', severity: 'medium', source: '' });
    setAddOpen(false);
    reload();
  };

  const exportFindings = (fileFormat: 'csv' | 'pdf') => {
    if (visible.length === 0) return;
    const scope = filter === 'all' ? 'toutes' : filter;
    const fileName = `aquapilote-securite-${scope}-${timestampSuffix()}`;
    if (fileFormat === 'csv') {
      exportRowsToCsv(visible, FINDING_COLUMNS, fileName);
    } else {
      exportRowsToPdf(visible, FINDING_COLUMNS, fileName, {
        title: 'Alertes de sécurité',
        subtitle: `Filtre : ${scope}`,
      });
    }
    toast({
      title: 'Export généré',
      description: `${visible.length} alerte(s) exportée(s) en ${fileFormat.toUpperCase()}.`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          Sécurité — alertes
          {openCount > 0 && <Badge variant="destructive">{openCount} ouverte(s)</Badge>}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Ouvertes</SelectItem>
              <SelectItem value="fixed">Corrigées</SelectItem>
              <SelectItem value="ignored">Ignorées</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={visible.length === 0}
            onClick={() => exportFindings('csv')}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={visible.length === 0}
            onClick={() => exportFindings('pdf')}
          >
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length === 0 && !loading && (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium text-green-600">Aucune alerte dans ce filtre</p>
            <p className="text-sm text-muted-foreground mt-1">Le niveau de sécurité est conforme.</p>
          </div>
        )}
        {visible.map((f) => (
          <div key={f.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className={SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.info}>{f.severity.toUpperCase()}</Badge>
              <Badge variant="outline">{f.status}</Badge>
              {f.source && <Badge variant="secondary">{f.source}</Badge>}
              <span className="text-xs text-muted-foreground">
                {format(new Date(f.detected_at), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <p className="font-medium">{f.title}</p>
            {f.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.description}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {f.status !== 'fixed' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus(f, 'fixed')}>
                  <ShieldCheck className="w-4 h-4 mr-1" /> Marquer corrigée
                </Button>
              )}
              {f.status !== 'ignored' && (
                <Button size="sm" variant="ghost" onClick={() => updateStatus(f, 'ignored')}>
                  <EyeOff className="w-4 h-4 mr-1" /> Ignorer
                </Button>
              )}
              {f.status !== 'open' && (
                <Button size="sm" variant="ghost" onClick={() => updateStatus(f, 'open')}>
                  Rouvrir
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle alerte de sécurité</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Titre"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={200}
            />
            <Textarea
              placeholder="Description / impact"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              maxLength={2000}
            />
            <Input
              placeholder="Source (table, fonction, module…)"
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              maxLength={120}
            />
            <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="high">Élevée</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={addFinding} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SecurityFindingsPanel;

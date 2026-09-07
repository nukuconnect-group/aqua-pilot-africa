import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileText, Plus, Download, Edit, Trash2, CheckCircle2, AlertTriangle, FileSignature } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import type { Employee } from '@/hooks/useEmployees';

type ContractStatus = 'draft' | 'active' | 'signed' | 'expired' | 'terminated';
type ContractType = 'CDI' | 'CDD' | 'Stage' | 'Prestation' | 'Interim' | 'Apprentissage';

interface EmploymentContract {
  id: string;
  user_id: string;
  employee_id: string;
  contract_type: ContractType;
  reference: string | null;
  start_date: string;
  end_date: string | null;
  trial_period_days: number | null;
  weekly_hours: number | null;
  gross_salary: number;
  currency: string;
  job_title: string | null;
  workplace: string | null;
  clauses: string | null;
  benefits: string | null;
  notice_period_days: number | null;
  status: ContractStatus;
  signed_at: string | null;
  signed_by_employer: string | null;
  signed_by_employee: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
}

const CONTRACT_TEMPLATES: Array<{ type: ContractType; label: string; defaults: Partial<EmploymentContract> }> = [
  { type: 'CDI', label: 'CDI - Contrat à durée indéterminée', defaults: { trial_period_days: 90, weekly_hours: 40, notice_period_days: 30 } },
  { type: 'CDD', label: 'CDD - Contrat à durée déterminée', defaults: { trial_period_days: 30, weekly_hours: 40, notice_period_days: 15 } },
  { type: 'Stage', label: 'Convention de stage', defaults: { trial_period_days: 0, weekly_hours: 35, notice_period_days: 7 } },
  { type: 'Prestation', label: 'Contrat de prestation', defaults: { trial_period_days: 0, weekly_hours: 0, notice_period_days: 15 } },
  { type: 'Interim', label: "Contrat d'intérim", defaults: { trial_period_days: 0, weekly_hours: 40, notice_period_days: 7 } },
  { type: 'Apprentissage', label: "Contrat d'apprentissage", defaults: { trial_period_days: 45, weekly_hours: 35, notice_period_days: 15 } },
];

const STATUS_BADGES: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-slate-100 text-slate-800' },
  active: { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
  signed: { label: 'Signé', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Expiré', className: 'bg-amber-100 text-amber-800' },
  terminated: { label: 'Résilié', className: 'bg-red-100 text-red-800' },
};

interface Props {
  employees: Employee[];
}

const emptyForm = (userId: string): Partial<EmploymentContract> => ({
  user_id: userId,
  contract_type: 'CDI',
  reference: `CTR-${Date.now().toString().slice(-6)}`,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  trial_period_days: 90,
  weekly_hours: 40,
  gross_salary: 0,
  currency: 'XOF',
  job_title: '',
  workplace: '',
  clauses: '',
  benefits: '',
  notice_period_days: 30,
  status: 'draft',
  notes: '',
});

const EmploymentContractsManager: React.FC<Props> = ({ employees }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { companyInfo, formatCurrency } = useSettings();
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmploymentContract | null>(null);
  const [form, setForm] = useState<Partial<EmploymentContract>>(emptyForm(user?.id || ''));
  const [step, setStep] = useState(1);

  const fetchContracts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employment_contracts' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContracts((data || []) as unknown as EmploymentContract[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const openNew = (empId?: string) => {
    setEditing(null);
    setForm({ ...emptyForm(user?.id || ''), employee_id: empId });
    setStep(1);
    setShowForm(true);
  };

  const openEdit = (c: EmploymentContract) => {
    setEditing(c);
    setForm(c);
    setStep(1);
    setShowForm(true);
  };

  const applyTemplate = (type: ContractType) => {
    const tpl = CONTRACT_TEMPLATES.find((t) => t.type === type);
    setForm((f) => ({ ...f, contract_type: type, ...(tpl?.defaults || {}) }));
  };

  const validateStep = (n: number): string | null => {
    if (n === 1) {
      if (!form.employee_id) return 'Sélectionnez un employé.';
      if (!form.contract_type) return 'Choisissez un type de contrat.';
    }
    if (n === 2) {
      if (!form.start_date) return 'La date de début est obligatoire.';
      if (form.contract_type === 'CDD' && !form.end_date) return 'Un CDD nécessite une date de fin.';
      if (form.end_date && form.start_date && form.end_date < form.start_date) return 'La date de fin doit être postérieure au début.';
    }
    if (n === 3) {
      if (!form.gross_salary || form.gross_salary < 0) return 'Le salaire brut doit être renseigné.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateStep(1) || validateStep(2) || validateStep(3);
    if (err) { toast({ title: 'Formulaire incomplet', description: err, variant: 'destructive' }); return; }
    try {
      const payload: any = { ...form, user_id: user?.id };
      delete payload.id;
      delete payload.created_at;
      if (editing) {
        const { error } = await supabase.from('employment_contracts' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Contrat mis à jour' });
      } else {
        const { error } = await supabase.from('employment_contracts' as any).insert(payload);
        if (error) throw error;
        toast({ title: 'Contrat créé' });
      }
      setShowForm(false);
      fetchContracts();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('employment_contracts' as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Contrat supprimé' });
      fetchContracts();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleSign = async (c: EmploymentContract) => {
    try {
      const { error } = await supabase
        .from('employment_contracts' as any)
        .update({ status: 'signed', signed_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) throw error;
      toast({ title: 'Contrat signé' });
      fetchContracts();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const generatePdf = async (c: EmploymentContract) => {
    const emp = employees.find((e) => e.id === c.employee_id);
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 20;
    const brand: [number, number, number] = [30, 58, 95];
    const accent: [number, number, number] = [49, 130, 206];

    // En-tête
    doc.setFillColor(...brand);
    doc.rect(0, 0, pw, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyInfo?.name || 'AQUAPILOTE', m, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (companyInfo?.address) doc.text(companyInfo.address.substring(0, 80), m, 22);
    doc.setFontSize(9);
    doc.text(`Réf : ${c.reference || '-'}`, pw - m, 15, { align: 'right' });
    doc.text(new Date().toLocaleDateString('fr-FR'), pw - m, 22, { align: 'right' });

    // Titre
    doc.setTextColor(...brand);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`CONTRAT ${c.contract_type.toUpperCase()}`, pw / 2, 45, { align: 'center' });
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(pw / 2 - 30, 48, pw / 2 + 30, 48);

    // Parties
    let y = 60;
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ENTRE LES SOUSSIGNÉS', m, y); y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(`L'employeur : ${companyInfo?.name || '—'}${companyInfo?.address ? `, ${companyInfo.address}` : ''}, représenté par ses soins, ci-après désigné "L'Employeur".`, pw - m * 2), m, y);
    y += 14;
    doc.text(doc.splitTextToSize(`Le salarié : ${emp ? `${emp.firstName} ${emp.lastName}` : '—'}, exerçant en qualité de ${c.job_title || emp?.position || '—'}, ci-après désigné "Le Salarié".`, pw - m * 2), m, y);
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.text('IL A ÉTÉ CONVENU CE QUI SUIT :', m, y); y += 8;

    // Articles
    const article = (title: string, body: string) => {
      if (y > ph - 40) { doc.addPage(); y = m; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...brand);
      doc.text(title, m, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(body, pw - m * 2);
      doc.text(lines, m, y); y += lines.length * 5 + 4;
    };

    article('Article 1 — Nature du contrat', `Le présent contrat est un ${c.contract_type}${c.end_date ? ` conclu du ${new Date(c.start_date).toLocaleDateString('fr-FR')} au ${new Date(c.end_date).toLocaleDateString('fr-FR')}` : ` prenant effet le ${new Date(c.start_date).toLocaleDateString('fr-FR')}`}. ${c.trial_period_days ? `Une période d'essai de ${c.trial_period_days} jours est prévue.` : ''}`);
    article('Article 2 — Fonctions et lieu de travail', `Le Salarié occupe le poste de ${c.job_title || emp?.position || '—'}. Le lieu de travail principal est ${c.workplace || '—'}. Il pourra être amené à se déplacer selon les besoins de l'exploitation.`);
    article('Article 3 — Durée du travail', `La durée hebdomadaire de travail est fixée à ${c.weekly_hours || 40} heures.`);
    article('Article 4 — Rémunération', `Le Salarié percevra une rémunération brute mensuelle de ${new Intl.NumberFormat('fr-FR').format(c.gross_salary)} ${c.currency}. Les avantages en nature et primes éventuelles sont détaillés en annexe.`);
    if (c.benefits) article('Article 5 — Avantages', c.benefits);
    article(`Article ${c.benefits ? 6 : 5} — Préavis`, `En cas de rupture du contrat, un préavis de ${c.notice_period_days || 30} jours devra être respecté, sauf faute grave ou accord entre les parties.`);
    if (c.clauses) article(`Article ${c.benefits ? 7 : 6} — Clauses particulières`, c.clauses);

    // Signatures
    if (y > ph - 60) { doc.addPage(); y = m; }
    y = Math.max(y + 10, ph - 55);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...brand);
    doc.text("Fait à _______________________, le _______________________", m, y); y += 12;
    doc.setDrawColor(...brand); doc.setLineWidth(0.3);
    const bw = (pw - m * 2 - 10) / 2;
    doc.roundedRect(m, y, bw, 30, 2, 2, 'S');
    doc.roundedRect(m + bw + 10, y, bw, 30, 2, 2, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text("L'Employeur", m + 3, y + 6);
    doc.text('Le Salarié', m + bw + 13, y + 6);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('(Nom, signature, cachet)', m + 3, y + 12);
    doc.text('(Nom et signature)', m + bw + 13, y + 12);

    // Pied
    doc.setDrawColor(...accent); doc.line(m, ph - 12, pw - m, ph - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`Contrat ${c.reference || ''} — ${companyInfo?.name || 'AQUAPILOTE'}`, m, ph - 6);
    doc.text(`Page 1`, pw - m, ph - 6, { align: 'right' });

    doc.save(`contrat_${c.reference || c.id}.pdf`);
  };

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: contracts.length,
      signed: contracts.filter((c) => c.status === 'signed').length,
      active: contracts.filter((c) => c.status === 'active' || c.status === 'signed').length,
      expiringSoon: contracts.filter((c) => c.end_date && new Date(c.end_date) > now && (new Date(c.end_date).getTime() - now.getTime()) / 86400000 < 30).length,
    };
  }, [contracts]);

  const empName = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : '—';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><FileSignature className="w-5 h-5 text-primary" /> Contrats de travail</CardTitle>
            <CardDescription>Modèles, validation, dates clés et export PDF pour chaque employé.</CardDescription>
          </div>
          <Button onClick={() => openNew()}><Plus className="w-4 h-4 mr-2" />Nouveau contrat</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{stats.total}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Signés</p><p className="text-xl font-bold text-emerald-600">{stats.signed}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">En cours</p><p className="text-xl font-bold text-blue-600">{stats.active}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">CDD expirant &lt;30j</p><p className="text-xl font-bold text-amber-600">{stats.expiringSoon}</p></div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : contracts.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Aucun contrat pour l'instant. Créez le premier contrat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Employé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Salaire</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => {
                    const status = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
                    const expiring = c.end_date && new Date(c.end_date) > new Date() && (new Date(c.end_date).getTime() - Date.now()) / 86400000 < 30;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.reference || '-'}</TableCell>
                        <TableCell>{empName(c.employee_id)}</TableCell>
                        <TableCell><Badge variant="outline">{c.contract_type}</Badge></TableCell>
                        <TableCell className="text-sm">
                          {new Date(c.start_date).toLocaleDateString('fr-FR')}
                          {c.end_date && <> → {new Date(c.end_date).toLocaleDateString('fr-FR')}</>}
                          {expiring && <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-600" />}
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.gross_salary)}</TableCell>
                        <TableCell><Badge className={status.className}>{status.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => generatePdf(c)} title="PDF"><Download className="w-4 h-4" /></Button>
                            {c.status !== 'signed' && (
                              <Button size="icon" variant="ghost" onClick={() => handleSign(c)} title="Marquer signé"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Modifier"><Edit className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                                  <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulaire multi-étapes */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le contrat' : 'Nouveau contrat'} — Étape {step}/4</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded ${n <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <Label>Employé *</Label>
                <Select value={form.employee_id || ''} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type / Modèle de contrat *</Label>
                <Select value={form.contract_type} onValueChange={(v) => applyTemplate(v as ContractType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TEMPLATES.map((t) => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Le modèle pré-remplit période d'essai, préavis et durée légale.</p>
              </div>
              <div>
                <Label>Référence contrat</Label>
                <Input value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date de début *</Label>
                  <Input type="date" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Date de fin {form.contract_type === 'CDD' && '*'}</Label>
                  <Input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Période d'essai (jours)</Label>
                  <Input type="number" value={form.trial_period_days ?? 0} onChange={(e) => setForm({ ...form, trial_period_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Préavis (jours)</Label>
                  <Input type="number" value={form.notice_period_days ?? 0} onChange={(e) => setForm({ ...form, notice_period_days: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Lieu de travail</Label>
                <Input value={form.workplace || ''} onChange={(e) => setForm({ ...form, workplace: e.target.value })} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <Label>Intitulé du poste</Label>
                <Input value={form.job_title || ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Salaire brut mensuel *</Label>
                  <Input type="number" value={form.gross_salary ?? 0} onChange={(e) => setForm({ ...form, gross_salary: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Devise</Label>
                  <Select value={form.currency || 'XOF'} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XOF">XOF (F CFA)</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Heures hebdomadaires</Label>
                <Input type="number" value={form.weekly_hours ?? 40} onChange={(e) => setForm({ ...form, weekly_hours: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Avantages en nature / primes</Label>
                <Textarea rows={2} value={form.benefits || ''} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <Label>Clauses particulières</Label>
                <Textarea rows={4} placeholder="Clause de non-concurrence, confidentialité, mobilité…" value={form.clauses || ''} onChange={(e) => setForm({ ...form, clauses: e.target.value })} />
              </div>
              <div>
                <Label>Notes internes</Label>
                <Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div>
                <Label>Statut initial</Label>
                <Select value={form.status || 'draft'} onValueChange={(v) => setForm({ ...form, status: v as ContractStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="active">En cours</SelectItem>
                    <SelectItem value="signed">Signé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>Précédent</Button>
            {step < 4 ? (
              <Button onClick={() => {
                const err = validateStep(step);
                if (err) { toast({ title: 'Formulaire incomplet', description: err, variant: 'destructive' }); return; }
                setStep(step + 1);
              }}>Suivant</Button>
            ) : (
              <Button onClick={handleSave}>{editing ? 'Enregistrer' : 'Créer le contrat'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmploymentContractsManager;
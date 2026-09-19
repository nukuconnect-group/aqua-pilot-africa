import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { HandCoins, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import { useHrOperations } from '@/hooks/useHrOperations';
import type { Employee } from '@/hooks/useEmployees';

interface Props {
  employees: Employee[];
  unitId?: string;
}

const LoansManagement = ({ employees, unitId }: Props) => {
  const { toast } = useToast();
  const { formatCurrency } = useSettings();
  const { loans, addLoan, addRepayment, loanDetails } = useHrOperations(unitId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    amount: 0,
    monthlyAmount: 0,
    months: 0,
    startDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const submit = async () => {
    const employee = employees.find(e => e.id === form.employeeId);
    if (!employee || form.amount <= 0 || form.monthlyAmount <= 0) {
      toast({ title: 'Formulaire incomplet', description: 'Employé, montant et remboursement mensuel sont requis.', variant: 'destructive' });
      return;
    }
    const months = form.months > 0 ? form.months : Math.ceil(form.amount / form.monthlyAmount);
    await addLoan({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      unitId: employee.unitId,
      amount: form.amount,
      monthlyAmount: form.monthlyAmount,
      months,
      startDate: form.startDate,
      reason: form.reason,
    });
    toast({
      title: 'Prêt enregistré',
      description: `${formatCurrency(form.amount)} pour ${employee.firstName} ${employee.lastName} — ${formatCurrency(form.monthlyAmount)}/mois déduits de la paie`,
    });
    setForm({ employeeId: '', amount: 0, monthlyAmount: 0, months: 0, startDate: new Date().toISOString().split('T')[0], reason: '' });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <HandCoins className="w-4 h-4" /> Prêts et avances
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouveau prêt
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {loans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun prêt ou avance enregistré.</p>
          ) : (
            loans.map(loan => {
              const { repaid, remaining, installmentsLeft, history } = loanDetails(loan);
              const progress = loan.amount > 0 ? Math.min(100, (repaid / loan.amount) * 100) : 0;
              return (
                <div key={loan.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{loan.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        Depuis le {new Date(loan.startDate).toLocaleDateString()} · {formatCurrency(loan.monthlyAmount)}/mois
                        {loan.reason ? ` · ${loan.reason}` : ''}
                      </p>
                    </div>
                    <Badge className={loan.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                      {loan.status === 'completed' ? 'Remboursé' : 'En cours'}
                    </Badge>
                  </div>
                  <Progress value={progress} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Initial</span><p className="font-semibold">{formatCurrency(loan.amount)}</p></div>
                    <div><span className="text-muted-foreground">Remboursé</span><p className="font-semibold">{formatCurrency(repaid)}</p></div>
                    <div><span className="text-muted-foreground">Restant</span><p className="font-semibold">{formatCurrency(remaining)}</p></div>
                    <div><span className="text-muted-foreground">Échéances restantes</span><p className="font-semibold">{installmentsLeft}</p></div>
                  </div>
                  {history.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Historique des remboursements ({history.length})</summary>
                      <ul className="mt-1 space-y-1">
                        {history.map(h => (
                          <li key={h.id}>
                            {new Date(h.date).toLocaleDateString()} — {formatCurrency(h.amount)}
                            {h.period ? ` (paie ${h.period})` : ''} · {h.source === 'payroll' ? 'Sur salaire' : 'Manuel'}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {remaining > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addRepayment(loan.id, Math.min(loan.monthlyAmount, remaining), undefined, 'manual')}
                    >
                      Enregistrer un remboursement de {formatCurrency(Math.min(loan.monthlyAmount, remaining))}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau prêt / avance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employé</Label>
              <Select value={form.employeeId} onValueChange={v => setForm({ ...form, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Montant du prêt</Label>
                <Input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Remboursement mensuel</Label>
                <Input type="number" value={form.monthlyAmount || ''} onChange={e => setForm({ ...form, monthlyAmount: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Durée (mois)</Label>
                <Input
                  type="number"
                  placeholder={form.amount && form.monthlyAmount ? String(Math.ceil(form.amount / form.monthlyAmount)) : ''}
                  value={form.months || ''}
                  onChange={e => setForm({ ...form, months: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Début du remboursement</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Motif (facultatif)</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Le remboursement mensuel est automatiquement déduit du bulletin de paie jusqu'au solde complet.
            </p>
            <Button className="w-full" onClick={submit}>Enregistrer le prêt</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoansManagement;

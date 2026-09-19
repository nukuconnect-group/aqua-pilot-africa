import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Plus, Check, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHrOperations, countLeaveDays, type LeaveType } from '@/hooks/useHrOperations';
import type { Employee } from '@/hooks/useEmployees';

const LEAVE_TYPES: Array<{ value: LeaveType; label: string }> = [
  { value: 'annuel', label: 'Congé annuel' },
  { value: 'maladie', label: 'Congé maladie' },
  { value: 'maternite', label: 'Congé maternité' },
  { value: 'paternite', label: 'Congé paternité' },
  { value: 'sans_solde', label: 'Congé sans solde' },
  { value: 'exceptionnel', label: 'Congé exceptionnel' },
];

interface Props {
  employees: Employee[];
  unitId?: string;
}

const LeaveManagement = ({ employees, unitId }: Props) => {
  const { toast } = useToast();
  const { leaves, addLeave, setLeaveStatus, deleteLeave, leaveBalance } = useHrOperations(unitId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    type: 'annuel' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  });

  const days = countLeaveDays(form.startDate, form.endDate);

  const submit = async () => {
    const employee = employees.find(e => e.id === form.employeeId);
    if (!employee || days <= 0) {
      toast({ title: 'Formulaire incomplet', description: 'Choisissez un employé et des dates valides.', variant: 'destructive' });
      return;
    }
    await addLeave({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      unitId: employee.unitId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days,
      reason: form.reason,
    });
    toast({ title: 'Demande enregistrée', description: `${days} jour(s) pour ${employee.firstName} ${employee.lastName}` });
    setForm({ employeeId: '', type: 'annuel', startDate: '', endDate: '', reason: '' });
    setOpen(false);
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800">Validé</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800">Refusé</Badge>;
    return <Badge className="bg-amber-100 text-amber-800">En attente</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Gestion des congés
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle demande
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {leaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucune demande de congé enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map(leave => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{leave.employeeName}</TableCell>
                      <TableCell>{LEAVE_TYPES.find(t => t.value === leave.type)?.label ?? leave.type}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{leave.days} j</TableCell>
                      <TableCell>{statusBadge(leave.status)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {leave.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setLeaveStatus(leave.id, 'approved')}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setLeaveStatus(leave.id, 'rejected')}>
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteLeave(leave.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {employees.length > 0 && (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">Soldes de congés ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map(emp => {
              const balance = leaveBalance(emp.id);
              return (
                <div key={emp.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                  <p className="text-muted-foreground text-xs">
                    Pris : {balance.used} j · Restant : <span className="font-semibold text-foreground">{balance.remaining} j</span> / {balance.allowance} j
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle demande de congé</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employé</Label>
              <Select value={form.employeeId} onValueChange={v => setForm({ ...form, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de congé</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as LeaveType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Durée calculée : <span className="font-semibold text-foreground">{days} jour(s)</span></p>
            <div>
              <Label>Motif (facultatif)</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <Button className="w-full" onClick={submit}>Enregistrer la demande</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;

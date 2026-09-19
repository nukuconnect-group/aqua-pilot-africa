import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';

export type LeaveType = 'annuel' | 'maladie' | 'maternite' | 'paternite' | 'sans_solde' | 'exceptionnel';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  unitId?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  period?: string;
  source: 'payroll' | 'manual';
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  unitId?: string;
  amount: number;
  monthlyAmount: number;
  months: number;
  startDate: string;
  reason?: string;
  status: 'active' | 'completed';
  createdAt: string;
}

const LEAVE_KEY = 'hr-leave-requests';
const LOAN_KEY = 'hr-employee-loans';
const REPAY_KEY = 'hr-loan-repayments';

const read = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
};

const write = <T,>(key: string, value: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

/** Nombre de jours calendaires inclus entre deux dates. */
export const countLeaveDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
};

export const DEFAULT_ANNUAL_LEAVE_DAYS = 30;

/**
 * Congés, prêts et remboursements. Les données sont stockées dans la base
 * quand les tables existent, avec repli local sinon (aucune donnée fictive).
 */
export const useHrOperations = (unitId?: string) => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [remoteAvailable, setRemoteAvailable] = useState(false);

  const load = useCallback(async () => {
    const localLeaves = read<LeaveRequest>(LEAVE_KEY);
    const localLoans = read<EmployeeLoan>(LOAN_KEY);
    const localRepay = read<LoanRepayment>(REPAY_KEY);

    if (!user?.id) {
      setLeaves(localLeaves);
      setLoans(localLoans);
      setRepayments(localRepay);
      return;
    }

    try {
      const [l, ln, r] = await Promise.all([
        supabase.from('leave_requests' as never).select('*'),
        supabase.from('employee_loans' as never).select('*'),
        supabase.from('loan_repayments' as never).select('*'),
      ]);

      if (l.error || ln.error || r.error) throw l.error || ln.error || r.error;
      setRemoteAvailable(true);

      setLeaves((l.data as unknown as Record<string, unknown>[]).map(row => ({
        id: String(row.id),
        employeeId: String(row.employee_id),
        employeeName: String(row.employee_name ?? ''),
        unitId: row.unit_id ? String(row.unit_id) : undefined,
        type: (row.type as LeaveType) ?? 'annuel',
        startDate: String(row.start_date),
        endDate: String(row.end_date),
        days: Number(row.days ?? 0),
        reason: row.reason ? String(row.reason) : undefined,
        status: (row.status as LeaveStatus) ?? 'pending',
        createdAt: String(row.created_at ?? new Date().toISOString()),
      })));

      setLoans((ln.data as unknown as Record<string, unknown>[]).map(row => ({
        id: String(row.id),
        employeeId: String(row.employee_id),
        employeeName: String(row.employee_name ?? ''),
        unitId: row.unit_id ? String(row.unit_id) : undefined,
        amount: Number(row.amount ?? 0),
        monthlyAmount: Number(row.monthly_amount ?? 0),
        months: Number(row.months ?? 0),
        startDate: String(row.start_date),
        reason: row.reason ? String(row.reason) : undefined,
        status: (row.status as 'active' | 'completed') ?? 'active',
        createdAt: String(row.created_at ?? new Date().toISOString()),
      })));

      setRepayments((r.data as unknown as Record<string, unknown>[]).map(row => ({
        id: String(row.id),
        loanId: String(row.loan_id),
        date: String(row.date),
        amount: Number(row.amount ?? 0),
        period: row.period ? String(row.period) : undefined,
        source: (row.source as 'payroll' | 'manual') ?? 'manual',
      })));
    } catch {
      setRemoteAvailable(false);
      setLeaves(localLeaves);
      setLoans(localLoans);
      setRepayments(localRepay);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const filteredLeaves = useMemo(
    () => (unitId ? leaves.filter(l => !l.unitId || l.unitId === unitId) : leaves),
    [leaves, unitId],
  );
  const filteredLoans = useMemo(
    () => (unitId ? loans.filter(l => !l.unitId || l.unitId === unitId) : loans),
    [loans, unitId],
  );

  const addLeave = async (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'> & { status?: LeaveStatus }) => {
    const entry: LeaveRequest = {
      ...data,
      status: data.status ?? 'pending',
      id: `leave-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (remoteAvailable && user?.id) {
      try {
        const { data: row, error } = await supabase
          .from('leave_requests' as never)
          .insert({
            user_id: user.id,
            employee_id: entry.employeeId,
            employee_name: entry.employeeName,
            unit_id: entry.unitId ?? null,
            type: entry.type,
            start_date: entry.startDate,
            end_date: entry.endDate,
            days: entry.days,
            reason: entry.reason ?? null,
            status: entry.status,
          } as never)
          .select()
          .single();
        if (!error && row) entry.id = String((row as Record<string, unknown>).id);
      } catch { /* repli local */ }
    }

    const next = [entry, ...leaves];
    setLeaves(next);
    if (!remoteAvailable) write(LEAVE_KEY, next);
    return entry;
  };

  const setLeaveStatus = async (id: string, status: LeaveStatus) => {
    const next = leaves.map(l => (l.id === id ? { ...l, status } : l));
    setLeaves(next);
    if (remoteAvailable) {
      try {
        await supabase.from('leave_requests' as never).update({ status } as never).eq('id', id);
      } catch { /* ignore */ }
    } else {
      write(LEAVE_KEY, next);
    }
  };

  const deleteLeave = async (id: string) => {
    const next = leaves.filter(l => l.id !== id);
    setLeaves(next);
    if (remoteAvailable) {
      try { await supabase.from('leave_requests' as never).delete().eq('id', id); } catch { /* ignore */ }
    } else {
      write(LEAVE_KEY, next);
    }
  };

  const addLoan = async (data: Omit<EmployeeLoan, 'id' | 'createdAt' | 'status'>) => {
    const entry: EmployeeLoan = {
      ...data,
      status: 'active',
      id: `loan-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (remoteAvailable && user?.id) {
      try {
        const { data: row, error } = await supabase
          .from('employee_loans' as never)
          .insert({
            user_id: user.id,
            employee_id: entry.employeeId,
            employee_name: entry.employeeName,
            unit_id: entry.unitId ?? null,
            amount: entry.amount,
            monthly_amount: entry.monthlyAmount,
            months: entry.months,
            start_date: entry.startDate,
            reason: entry.reason ?? null,
            status: entry.status,
          } as never)
          .select()
          .single();
        if (!error && row) entry.id = String((row as Record<string, unknown>).id);
      } catch { /* repli local */ }
    }

    const next = [entry, ...loans];
    setLoans(next);
    if (!remoteAvailable) write(LOAN_KEY, next);
    return entry;
  };

  const repaidFor = useCallback(
    (loanId: string) => repayments.filter(r => r.loanId === loanId).reduce((s, r) => s + r.amount, 0),
    [repayments],
  );

  const addRepayment = async (loanId: string, amount: number, period?: string, source: 'payroll' | 'manual' = 'manual') => {
    if (amount <= 0) return null;
    const entry: LoanRepayment = {
      id: `repay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      loanId,
      amount,
      period,
      source,
      date: new Date().toISOString().split('T')[0],
    };

    if (remoteAvailable && user?.id) {
      try {
        await supabase.from('loan_repayments' as never).insert({
          user_id: user.id,
          loan_id: loanId,
          amount,
          period: period ?? null,
          source,
          date: entry.date,
        } as never);
      } catch { /* repli local */ }
    }

    const nextRepayments = [entry, ...repayments];
    setRepayments(nextRepayments);
    if (!remoteAvailable) write(REPAY_KEY, nextRepayments);

    // Clôturer le prêt quand il est intégralement remboursé
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      const totalRepaid = nextRepayments.filter(r => r.loanId === loanId).reduce((s, r) => s + r.amount, 0);
      if (totalRepaid >= loan.amount && loan.status !== 'completed') {
        const nextLoans = loans.map(l => (l.id === loanId ? { ...l, status: 'completed' as const } : l));
        setLoans(nextLoans);
        if (remoteAvailable) {
          try { await supabase.from('employee_loans' as never).update({ status: 'completed' } as never).eq('id', loanId); } catch { /* ignore */ }
        } else {
          write(LOAN_KEY, nextLoans);
        }
      }
    }
    return entry;
  };

  /** Détail d'un prêt : remboursé, restant, échéances restantes. */
  const loanDetails = useCallback((loan: EmployeeLoan) => {
    const repaid = repaidFor(loan.id);
    const remaining = Math.max(0, loan.amount - repaid);
    const installmentsLeft = loan.monthlyAmount > 0 ? Math.ceil(remaining / loan.monthlyAmount) : 0;
    return {
      repaid,
      remaining,
      installmentsLeft,
      history: repayments.filter(r => r.loanId === loan.id).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [repaidFor, repayments]);

  /** Retenue de paie pour un employé sur une période donnée. */
  const payrollDeductionFor = useCallback((employeeId: string, period: string) => {
    return loans
      .filter(l => l.employeeId === employeeId && l.status === 'active')
      .reduce((sum, loan) => {
        const { remaining } = loanDetails(loan);
        if (remaining <= 0) return sum;
        const alreadyThisPeriod = repayments.some(r => r.loanId === loan.id && r.period === period);
        if (alreadyThisPeriod) return sum;
        return sum + Math.min(loan.monthlyAmount, remaining);
      }, 0);
  }, [loans, loanDetails, repayments]);

  /** Enregistre les remboursements correspondant à un bulletin de paie. */
  const applyPayrollRepayments = useCallback(async (employeeId: string, period: string) => {
    for (const loan of loans.filter(l => l.employeeId === employeeId && l.status === 'active')) {
      const { remaining } = loanDetails(loan);
      if (remaining <= 0) continue;
      if (repayments.some(r => r.loanId === loan.id && r.period === period)) continue;
      await addRepayment(loan.id, Math.min(loan.monthlyAmount, remaining), period, 'payroll');
    }
  }, [loans, loanDetails, repayments]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Solde de congés annuels restant pour un employé. */
  const leaveBalance = useCallback((employeeId: string, allowance = DEFAULT_ANNUAL_LEAVE_DAYS) => {
    const year = new Date().getFullYear();
    const used = leaves
      .filter(l => l.employeeId === employeeId && l.status === 'approved' && new Date(l.startDate).getFullYear() === year)
      .reduce((s, l) => s + l.days, 0);
    return { allowance, used, remaining: Math.max(0, allowance - used) };
  }, [leaves]);

  return {
    leaves: filteredLeaves,
    loans: filteredLoans,
    repayments,
    remoteAvailable,
    reload: load,
    addLeave,
    setLeaveStatus,
    deleteLeave,
    addLoan,
    addRepayment,
    loanDetails,
    payrollDeductionFor,
    applyPayrollRepayments,
    leaveBalance,
    countLeaveDays,
  };
};

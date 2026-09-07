import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  unitId: string;
  unitName: string;
  salary: number;
  hireDate: string;
  status: 'active' | 'inactive' | 'vacation';
  contractType: 'CDI' | 'CDD' | 'Stage' | 'Freelance';
}

export interface PaySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  baseSalary: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  generatedAt: string;
  unitId: string;
}

export const useEmployees = () => {
  const { isDemoMode, user, isAuthenticated } = useAuth();
  const { activeUnit, units } = useProductionUnits();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paySlips, setPaySlips] = useState<PaySlip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (isDemoMode) {
      setEmployees([]);
      setPaySlips([]);
      return;
    }
    if (!user?.id || !isAuthenticated) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEmployees((data || []).map((e: any) => ({
        id: e.id,
        firstName: e.first_name,
        lastName: e.last_name,
        email: e.email || '',
        phone: e.phone || '',
        position: e.position || '',
        unitId: e.unit_id,
        unitName: e.unit_name || '',
        salary: e.salary,
        hireDate: e.hire_date || '',
        status: e.status as Employee['status'],
        contractType: e.contract_type as Employee['contractType']
      })));

      const { data: payData, error: payError } = await supabase
        .from('pay_slips')
        .select('*')
        .order('created_at', { ascending: false });

      if (payError) throw payError;

      setPaySlips((payData || []).map((p: any) => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeName: p.employee_name,
        period: p.period,
        baseSalary: p.base_salary,
        overtime: p.overtime,
        bonuses: p.bonuses,
        deductions: p.deductions,
        netSalary: p.net_salary,
        generatedAt: p.generated_at,
        unitId: p.unit_id
      })));
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, user?.id, isAuthenticated]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Synchronisation temps réel
  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    const channel = supabase
      .channel(`employees-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchEmployees())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pay_slips' }, () => fetchEmployees())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDemoMode, user?.id, fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    if (!activeUnit?.id) return employees;
    return employees.filter(e => e.unitId === activeUnit.id);
  }, [employees, activeUnit?.id]);

  const filteredPaySlips = useMemo(() => {
    if (!activeUnit?.id) return paySlips;
    return paySlips.filter(p => p.unitId === activeUnit.id);
  }, [paySlips, activeUnit?.id]);

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    if (isDemoMode) {
      const newEmployee: Employee = { ...employee, id: Date.now().toString() };
      setEmployees(prev => [newEmployee, ...prev]);
      return newEmployee;
    }
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('employees')
        .insert({
          user_id: user.id,
          unit_id: employee.unitId,
          unit_name: employee.unitName,
          first_name: employee.firstName,
          last_name: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          position: employee.position,
          salary: employee.salary,
          hire_date: employee.hireDate || null,
          status: employee.status,
          contract_type: employee.contractType
        })
        .select()
        .single();

      if (error) throw error;

      const newEmployee: Employee = {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email || '',
        phone: data.phone || '',
        position: data.position || '',
        unitId: data.unit_id,
        unitName: data.unit_name || '',
        salary: data.salary,
        hireDate: data.hire_date || '',
        status: data.status as Employee['status'],
        contractType: data.contract_type as Employee['contractType']
      };
      setEmployees(prev => [newEmployee, ...prev]);
      return newEmployee;
    } catch (err) {
      console.error('Error adding employee:', err);
      return null;
    }
  };

  const addPaySlip = async (paySlip: Omit<PaySlip, 'id'>) => {
    if (isDemoMode) {
      const newPaySlip: PaySlip = { ...paySlip, id: Date.now().toString() };
      setPaySlips(prev => [newPaySlip, ...prev]);
      return newPaySlip;
    }
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('pay_slips')
        .insert({
          user_id: user.id,
          unit_id: paySlip.unitId,
          employee_id: paySlip.employeeId,
          employee_name: paySlip.employeeName,
          period: paySlip.period,
          base_salary: paySlip.baseSalary,
          overtime: paySlip.overtime,
          bonuses: paySlip.bonuses,
          deductions: paySlip.deductions,
          net_salary: paySlip.netSalary,
          generated_at: paySlip.generatedAt
        })
        .select()
        .single();

      if (error) throw error;

      const newPaySlip: PaySlip = {
        id: data.id,
        employeeId: data.employee_id,
        employeeName: data.employee_name,
        period: data.period,
        baseSalary: data.base_salary,
        overtime: data.overtime,
        bonuses: data.bonuses,
        deductions: data.deductions,
        netSalary: data.net_salary,
        generatedAt: data.generated_at,
        unitId: data.unit_id
      };
      setPaySlips(prev => [newPaySlip, ...prev]);
      return newPaySlip;
    } catch (err) {
      console.error('Error adding pay slip:', err);
      return null;
    }
  };

  return {
    employees: filteredEmployees,
    paySlips: filteredPaySlips,
    allEmployees: employees,
    allPaySlips: paySlips,
    loading,
    addEmployee,
    addPaySlip,
    refetch: fetchEmployees
  };
};
